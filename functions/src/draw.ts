import type { DocumentData } from "firebase-admin/firestore";
import { HttpsError } from "firebase-functions/v2/https";
import { launchBlock, participantCount, readCommercial, rosterDecision } from "../../shared/billing";
import { decideLaunch, type EventStatus, type Exclusion } from "../../shared/domain";
import { explainDrawFailure, pairsOf, solveDraw } from "../../shared/draw/engine";
import { mergeExclusions } from "../../shared/draw/prior";
import { canRevealNow } from "../../shared/time";
import { appOrigin, assertVerifiedIfEmail, callable, db, newId, stamp, userName } from "./admin";
import { audit } from "./audit";
import { readConstraints, readMembers, readPrivate, refreshTeamProgress, requireOrganizer } from "./events";
import { issuePersonalToken } from "./invites";
import { queueEmail } from "./mail";
import { priorDrawExclusions } from "./prior-pairs";
import { loadTheme, templateVars } from "./theme";
import {
  asDate,
  copyWishes,
  materializeMember,
  namesOf,
  type StoredAssignment,
  writeParticipantViews,
  writeThreads,
} from "./views";

function fingerprint(memberIds: string[], constraints: Exclusion[], gifts: number, privacy: string): string {
  const normalized = constraints.map((constraint) => JSON.stringify(constraint)).sort();
  return JSON.stringify({ memberIds: [...memberIds].sort(), normalized, gifts, privacy });
}

async function exclusionsForDraw(
  eventId: string,
  data: DocumentData,
  members: Awaited<ReturnType<typeof readMembers>>,
  stored: Exclusion[],
): Promise<Exclusion[]> {
  if (data.avoidPriorPairs === false) return stored;
  const secrets = await readPrivate(eventId);
  const prior = await priorDrawExclusions(String(data.organizerUid ?? ""), eventId, members, secrets);
  return mergeExclusions(stored, prior);
}

export const checkFeasibility = callable(async (request, uid) => {
  const eventId = String((request.data as { eventId?: string })?.eventId ?? "");
  const { data } = await requireOrganizer(eventId, uid);
  const members = await readMembers(eventId);
  const stored = await readConstraints(eventId);
  const constraints = await exclusionsForDraw(eventId, data, members, stored);
  const solved = solveDraw({
    memberIds: members.map((member) => member.id),
    giftsPerPerson: Number(data.giftsPerPerson ?? 1),
    exclusions: constraints,
    avoidReciprocal: Boolean(data.avoidReciprocal),
  });
  const priorCount = constraints.filter((item) => item.kind === "history").length;
  const priorNote = priorCount
    ? [`${priorCount} paire${priorCount > 1 ? "s" : ""} déjà tirée${priorCount > 1 ? "s" : ""} ${priorCount > 1 ? "sont écartées" : "est écartée"}.`]
    : [];
  if (!solved.ok) {
    return { ok: false, messages: [...priorNote, ...explainDrawFailure(solved.reasons, namesOf(members))], reciprocalPreferenceRelaxed: false };
  }
  return {
    ok: true,
    reciprocalPreferenceRelaxed: solved.reciprocalPreferenceRelaxed,
    messages: [
      ...priorNote,
      solved.reciprocalPreferenceRelaxed
        ? "Un tirage est possible. L'évitement des échanges réciproques ne pourra pas être respecté."
        : "Un tirage est possible.",
    ],
  };
});

export const launchDraw = callable(async (request, uid) => {
  const eventId = String((request.data as { eventId?: string })?.eventId ?? "");
  const idempotencyKey = String((request.data as { idempotencyKey?: string })?.idempotencyKey ?? "");
  if (!/^[a-zA-Z0-9_-]{8,80}$/.test(idempotencyKey)) {
    throw new HttpsError("invalid-argument", "La clé de lancement est invalide.");
  }
  const { ref, data } = await requireOrganizer(eventId, uid);
  await assertVerifiedIfEmail(uid);
  const preview = decideLaunch(
    { status: data.status as EventStatus, idempotencyKey: data.idempotencyKey ?? null, lockUntil: null },
    idempotencyKey,
    Date.now(),
  );
  if (preview === "replay") return data.launchReceipt ?? { replay: true };
  if (preview === "already-drawn") throw new HttpsError("failed-precondition", "Le tirage a déjà été lancé.");
  if (preview === "invalid-status") throw new HttpsError("failed-precondition", "Cet échange ne peut pas être tiré.");

  const members = await readMembers(eventId);
  const commercial = readCommercial(data);
  const blocked = launchBlock(commercial);
  if (blocked) throw new HttpsError("failed-precondition", blocked);
  const fit = rosterDecision(participantCount(members), commercial.offerId);
  if (!fit.ok) throw new HttpsError("failed-precondition", fit.message);
  const stored = await readConstraints(eventId);
  const constraints = await exclusionsForDraw(eventId, data, members, stored);
  const gifts = Number(data.giftsPerPerson ?? 1);
  const before = fingerprint(members.map((member) => member.id), stored, gifts, String(data.privacyMode));
  const solved = solveDraw({
    memberIds: members.map((member) => member.id),
    giftsPerPerson: gifts,
    exclusions: constraints,
    avoidReciprocal: Boolean(data.avoidReciprocal),
  });
  if (!solved.ok) {
    throw new HttpsError("failed-precondition", explainDrawFailure(solved.reasons, namesOf(members)).join(" "));
  }
  const assignments: StoredAssignment[] = solved.assignments.map((edge) => ({ ...edge, threadId: newId() }));
  const outcome = await db.runTransaction(async (tx) => {
    const fresh = await tx.get(ref);
    const freshData = fresh.data() ?? {};
    const decision = decideLaunch(
      { status: freshData.status as EventStatus, idempotencyKey: freshData.idempotencyKey ?? null, lockUntil: null },
      idempotencyKey,
      Date.now(),
    );
    if (decision === "replay") return "replay" as const;
    if (decision !== "proceed") throw new HttpsError("failed-precondition", "Le tirage a déjà été lancé.");
    const memberSnap = await tx.get(ref.collection("members"));
    const constraintSnap = await tx.get(ref.collection("constraints"));
    const current = fingerprint(
      memberSnap.docs.map((doc) => doc.id),
      constraintSnap.docs.map((doc) => doc.data() as Exclusion),
      gifts,
      String(freshData.privacyMode),
    );
    if (current !== before) throw new HttpsError("failed-precondition", "Les participants ont changé. Relancez le tirage.");
    const version = Number(freshData.drawVersion ?? 0) + 1;
    tx.set(ref.collection("serverData").doc("draw"), {
      version,
      assignments,
      privacyMode: freshData.privacyMode,
      reciprocalPreferenceRelaxed: solved.reciprocalPreferenceRelaxed,
      distribution: solved.distribution,
      createdAt: stamp(),
    });
    tx.update(ref, {
      status: "drawn",
      drawVersion: version,
      idempotencyKey,
      launchReceipt: {
        reciprocalPreferenceRelaxed: solved.reciprocalPreferenceRelaxed,
        assignmentCount: assignments.length,
        distribution: solved.distribution,
      },
      updatedAt: stamp(),
    });
    if (freshData.privacyMode === "public") {
      const names = namesOf(members);
      tx.set(ref.collection("publishedBoard").doc("current"), {
        rows: assignments.map((edge) => ({
          giver: names.get(edge.giverId) ?? "Participant",
          recipient: names.get(edge.recipientId) ?? "Participant",
          slot: edge.slot,
        })),
      });
    }
    return "wrote" as const;
  });
  if (outcome === "replay") {
    const again = await ref.get();
    return again.data()?.launchReceipt ?? { replay: true };
  }
  const version = Number((await ref.get()).data()?.drawVersion ?? 1);
  await writeParticipantViews({
    eventId,
    drawVersion: version,
    privacyMode: data.privacyMode,
    revealed: false,
    members,
    assignments,
  });
  await writeThreads({ eventId, privacyMode: data.privacyMode, revealed: false, members, assignments });
  await copyWishes(eventId, data.privacyMode, false, members, assignments);
  await notifyDraw(eventId, data, members, uid, version);
  await audit(eventId, uid, "draw.launch");
  return {
    drawVersion: version,
    reciprocalPreferenceRelaxed: solved.reciprocalPreferenceRelaxed,
    assignmentCount: assignments.length,
    distribution: solved.distribution,
  };
}, { timeoutSeconds: 120, memory: "512MiB" });

async function notifyDraw(eventId: string, data: DocumentData, members: Awaited<ReturnType<typeof readMembers>>, uid: string, version: number) {
  const theme = await loadTheme(eventId, data);
  const organizer = await userName(uid);
  const origin = appOrigin();
  const secrets = await readPrivate(eventId);
  const index = await db.collection("events").doc(eventId).collection("memberIndex").get();
  const linked = new Set(index.docs.map((doc) => String(doc.data().memberId)));
  for (const member of members) {
    const email = String(secrets.get(member.id)?.email ?? "");
    if (!email) continue;
    const lien = linked.has(member.id) ? `${origin}/participations/${eventId}` : `${origin}/invitation/${await issuePersonalToken(eventId, member.id)}`;
    await queueEmail({
      idempotencyKey: `draw:${eventId}:${member.id}:${version}`,
      to: email,
      uid: null,
      eventId,
      templateId: "draw_ready",
      theme,
      vars: templateVars(data, member.displayName, organizer, lien),
    });
  }
}

export const revealEvent = callable(async (request, uid) => {
  const eventId = String((request.data as { eventId?: string })?.eventId ?? "");
  const { ref, data } = await requireOrganizer(eventId, uid);
  if (data.status !== "drawn") throw new HttpsError("failed-precondition", "La révélation collective n'est possible qu'après le tirage.");
  const revealAt = asDate(data.revealAt);
  if (!revealAt || !canRevealNow(new Date(), revealAt)) {
    throw new HttpsError("failed-precondition", "L'heure de révélation n'est pas encore atteinte pour le fuseau de l'échange.");
  }
  await ref.update({ status: "revealed", updatedAt: stamp() });
  const draw = await ref.collection("serverData").doc("draw").get();
  const assignments = (draw.data()?.assignments ?? []) as StoredAssignment[];
  const members = await readMembers(eventId);
  await writeParticipantViews({
    eventId,
    drawVersion: Number(draw.data()?.version ?? 1),
    privacyMode: data.privacyMode,
    revealed: true,
    members,
    assignments,
    preserveProgress: true,
  });
  const theme = await loadTheme(eventId, data);
  const organizer = await userName(uid);
  const secrets = await readPrivate(eventId);
  for (const member of members) {
    const email = String(secrets.get(member.id)?.email ?? "");
    if (!email) continue;
    await queueEmail({
      idempotencyKey: `reveal:${eventId}:${member.id}`,
      to: email,
      uid: null,
      eventId,
      templateId: "reveal_available",
      theme,
      vars: templateVars(data, member.displayName, organizer, `${appOrigin()}/participations/${eventId}`),
    });
  }
  await audit(eventId, uid, "event.reveal");
  return { status: "revealed" };
});

export const markDiscovered = callable(async (request, uid) => {
  const eventId = String((request.data as { eventId?: string })?.eventId ?? "");
  const memberId = String((request.data as { memberId?: string })?.memberId ?? "");
  const docId = memberId ? `${eventId}_${memberId}` : eventId;
  const ref = db.collection("users").doc(uid).collection("assignments").doc(docId);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError("not-found", "Aucun résultat n'est disponible pour vous.");
  if (memberId) {
    const index = await db.collection("events").doc(eventId).collection("memberIndex").doc(uid).get();
    const managed = (index.data()?.managedMemberIds ?? []) as string[];
    if (!managed.includes(memberId)) throw new HttpsError("permission-denied", "Vous ne représentez pas ce participant.");
  }
  if (snap.data()?.discoveredAt) return { already: true };
  await ref.update({ discoveredAt: stamp() });
  const ownerMemberId = String(snap.data()?.memberId ?? "");
  if (ownerMemberId) {
    const privateRef = db.collection("events").doc(eventId).collection("memberPrivate").doc(ownerMemberId);
    const secret = await privateRef.get();
    if (!secret.data()?.discoveredAt) {
      await privateRef.set({ discoveredAt: stamp() }, { merge: true });
      await db.collection("events").doc(eventId).update({ "stats.discovered": (await currentDiscovered(eventId)) });
      await refreshTeamProgress(eventId);
    }
  }
  return { already: false };
});

async function currentDiscovered(eventId: string): Promise<number> {
  const snap = await db.collection("events").doc(eventId).collection("memberPrivate").get();
  return snap.docs.filter((doc) => doc.data().discoveredAt).length;
}

export const markGift = callable(async (request, uid) => {
  const eventId = String((request.data as { eventId?: string })?.eventId ?? "");
  const slot = Number((request.data as { slot?: number })?.slot ?? 0);
  const handed = Boolean((request.data as { handed?: boolean })?.handed);
  const memberId = String((request.data as { memberId?: string })?.memberId ?? "");
  const ref = db.collection("users").doc(uid).collection("assignments").doc(memberId ? `${eventId}_${memberId}` : eventId);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError("not-found", "Aucun résultat n'est disponible.");
  const slots = ((snap.data()?.slots ?? []) as Array<{ slot: number; handedOver?: boolean }>).map((item) =>
    item.slot === slot ? { ...item, handedOver: handed } : item,
  );
  await ref.update({ slots, updatedAt: stamp() });
  return { ok: true };
});

export const materializeMyAssignment = callable(async (request, uid) => {
  const eventId = String((request.data as { eventId?: string })?.eventId ?? "");
  const index = await db.collection("events").doc(eventId).collection("memberIndex").doc(uid).get();
  if (!index.exists) throw new HttpsError("permission-denied", "Vous ne participez pas à cet échange.");
  await materializeMember(eventId, String(index.data()?.memberId), uid);
  return { ok: true };
});

export const lateMemberChange = callable(async (request, uid) => {
  const eventId = String((request.data as { eventId?: string })?.eventId ?? "");
  const action = String((request.data as { action?: string })?.action ?? "");
  const { ref, data } = await requireOrganizer(eventId, uid);
  if (data.status !== "drawn") {
    throw new HttpsError("failed-precondition", "L'ajout ou le retrait tardif n'est disponible qu'après le tirage et avant la révélation.");
  }
  if (Number(data.stats?.messages ?? 0) > 0) {
    throw new HttpsError(
      "failed-precondition",
      "Des messages ont déjà été échangés. Pour ne pas réattribuer en silence, annulez l'échange et recréez-le.",
    );
  }
  const members = await readMembers(eventId);
  const secrets = await readPrivate(eventId);
  const drawSnap = await ref.collection("serverData").doc("draw").get();
  const current = (drawSnap.data()?.assignments ?? []) as StoredAssignment[];
  const discovered = new Set(members.filter((member) => secrets.get(member.id)?.discoveredAt).map((member) => member.id));
  const locked = current.filter((edge) => discovered.has(edge.giverId));
  let nextMembers = members.slice();
  if (action === "remove") {
    const memberId = String((request.data as { memberId?: string })?.memberId ?? "");
    if (locked.some((edge) => edge.giverId === memberId || edge.recipientId === memberId)) {
      throw new HttpsError("failed-precondition", "Une attribution déjà découverte empêche de retirer cette personne.");
    }
    nextMembers = members.filter((member) => member.id !== memberId);
  } else if (action === "add") {
    const displayName = String((request.data as { displayName?: string })?.displayName ?? "").trim();
    if (displayName.length < 1) throw new HttpsError("invalid-argument", "Indiquez un prénom ou un pseudonyme.");
    const id = newId();
    nextMembers = [...members, { id, displayName, status: "draft", role: "participant", managedByMemberId: null, groupLabel: "" }];
  } else {
    throw new HttpsError("invalid-argument", "Action inconnue.");
  }
  const lateFit = rosterDecision(participantCount(nextMembers), readCommercial(data).offerId);
  if (!lateFit.ok) throw new HttpsError("failed-precondition", lateFit.message);
  const stored = await readConstraints(eventId);
  const constraints = await exclusionsForDraw(eventId, data, nextMembers, stored);
  const solved = solveDraw({
    memberIds: nextMembers.map((member) => member.id),
    giftsPerPerson: Number(data.giftsPerPerson ?? 1),
    exclusions: constraints,
    avoidReciprocal: Boolean(data.avoidReciprocal),
    locked: locked.map(({ giverId, recipientId, slot }) => ({ giverId, recipientId, slot })),
  });
  if (!solved.ok) {
    throw new HttpsError("failed-precondition", explainDrawFailure(solved.reasons, namesOf(nextMembers)).join(" "));
  }
  const lockedPairs = pairsOf(locked);
  if (![...lockedPairs].every((pair) => pairsOf(solved.assignments).has(pair))) {
    throw new HttpsError("failed-precondition", "Le nouveau tirage aurait modifié une attribution déjà découverte.");
  }
  const threadByPair = new Map(current.map((edge) => [`${edge.giverId}->${edge.recipientId}`, edge.threadId]));
  const assignments: StoredAssignment[] = solved.assignments.map((edge) => ({
    ...edge,
    threadId: threadByPair.get(`${edge.giverId}->${edge.recipientId}`) ?? newId(),
  }));
  if (action === "add") {
    const created = nextMembers[nextMembers.length - 1];
    if (created) {
      await ref.collection("members").doc(created.id).set({
        displayName: created.displayName,
        status: "draft",
        role: "participant",
        managedByMemberId: null,
        groupLabel: "",
        updatedAt: stamp(),
      });
      await ref.collection("memberPrivate").doc(created.id).set({ email: "", inviteState: "none", updatedAt: stamp() });
    }
  }
  if (action === "remove") {
    const memberId = String((request.data as { memberId?: string })?.memberId ?? "");
    await ref.collection("members").doc(memberId).delete();
    await ref.collection("memberPrivate").doc(memberId).delete();
  }
  const version = Number(data.drawVersion ?? 1) + 1;
  await ref.collection("serverData").doc("draw").set({
    version,
    assignments,
    privacyMode: data.privacyMode,
    reciprocalPreferenceRelaxed: solved.reciprocalPreferenceRelaxed,
    distribution: solved.distribution,
    createdAt: stamp(),
  });
  await ref.update({ drawVersion: version, updatedAt: stamp() });
  await writeParticipantViews({
    eventId,
    drawVersion: version,
    privacyMode: data.privacyMode,
    revealed: false,
    members: nextMembers,
    assignments,
    giverIds: new Set(nextMembers.filter((member) => !discovered.has(member.id)).map((member) => member.id)),
  });
  await writeThreads({ eventId, privacyMode: data.privacyMode, revealed: false, members: nextMembers, assignments });
  await audit(eventId, uid, `members.late.${action}`);
  return {
    ok: true,
    reciprocalPreferenceRelaxed: solved.reciprocalPreferenceRelaxed,
    messages: solved.reciprocalPreferenceRelaxed
      ? ["Le changement est enregistré. L'évitement des échanges réciproques n'a pas pu être maintenu."]
      : ["Le changement est enregistré. Les attributions déjà découvertes sont inchangées."],
  };
}, { timeoutSeconds: 120, memory: "512MiB" });
