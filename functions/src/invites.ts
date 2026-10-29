import { HttpsError } from "firebase-functions/v2/https";
import { appConfig } from "../../shared/config";
import { canClaim, inspectInvitationState, randomJoinCode, randomToken, sha256Hex } from "../../shared/invites";
import { participantCount, readCommercial, rosterDecision } from "../../shared/billing";
import { adminAuth, appOrigin, assertVerifiedIfEmail, callable, consumeRate, db, localLinksAllowed, newId, stamp, userName } from "./admin";
import { audit } from "./audit";
import { readMembers, requireOrganizer } from "./events";
import { queueEmail } from "./mail";
import { loadTheme, templateVars } from "./theme";
import { materializeMember } from "./views";

export async function issuePersonalToken(eventId: string, memberId: string): Promise<string> {
  const token = randomToken();
  const hash = await sha256Hex(token);
  const privateRef = db.collection("events").doc(eventId).collection("memberPrivate").doc(memberId);
  const previous = await privateRef.get();
  const oldHash = previous.data()?.tokenHash;
  if (typeof oldHash === "string" && oldHash) {
    await db.collection("invitationTokens").doc(oldHash).set({ revoked: true }, { merge: true });
  }
  await db.collection("invitationTokens").doc(hash).set({
    eventId,
    memberId,
    expiresAt: Date.now() + appConfig.invitationDays * 24 * 60 * 60 * 1000,
    revoked: false,
    claimedByUid: null,
    createdAt: stamp(),
  });
  await privateRef.set({ tokenHash: hash, inviteState: "pending", updatedAt: stamp() }, { merge: true });
  return token;
}

export const createInvitations = callable(async (request, uid) => {
  const eventId = String((request.data as { eventId?: string })?.eventId ?? "");
  const memberIds = ((request.data as { memberIds?: string[] })?.memberIds ?? []) as string[];
  const { data } = await requireOrganizer(eventId, uid);
  await assertVerifiedIfEmail(uid);
  if (!["draft", "registration_open", "ready", "drawn"].includes(String(data.status))) {
    throw new HttpsError("failed-precondition", "Les invitations ne sont plus ouvertes.");
  }
  await consumeRate(`invite_${uid}`, 30, 60 * 60 * 1000, "Trop d'invitations envoyées. Réessayez plus tard.");
  const members = await readMembers(eventId);
  const wanted = memberIds.length ? members.filter((member) => memberIds.includes(member.id)) : members;
  const origin = appOrigin();
  const theme = await loadTheme(eventId, data);
  const organizer = await userName(uid);
  const links: Array<{ memberId: string; url: string; emailQueued: boolean }> = [];
  for (const member of wanted) {
    if (member.role === "organizer" || member.status === "joined" || member.status === "pending") continue;
    const token = await issuePersonalToken(eventId, member.id);
    const url = `${origin}/invitation/${token}`;
    const privateSnap = await db.collection("events").doc(eventId).collection("memberPrivate").doc(member.id).get();
    const email = String(privateSnap.data()?.email ?? "");
    await db.collection("events").doc(eventId).collection("members").doc(member.id).set({ status: "invited" }, { merge: true });
    if (email) {
      await queueEmail({
        idempotencyKey: `invite:${eventId}:${member.id}:${privateSnap.data()?.tokenHash}`,
        to: email,
        uid: null,
        eventId,
        templateId: "invitation",
        theme,
        vars: templateVars(data, member.displayName, organizer, url),
        replyTo: theme.replyToEnabled ? String((await adminEmail(uid)) ?? "") : "",
      });
    }
    links.push({ memberId: member.id, url, emailQueued: Boolean(email) });
  }
  await audit(eventId, uid, "invites.create");
  return { links, localCapture: localLinksAllowed() && !process.env.RESEND_API_KEY };
});

export const resendInvitation = callable(async (request, uid) => {
  const eventId = String((request.data as { eventId?: string })?.eventId ?? "");
  const memberId = String((request.data as { memberId?: string })?.memberId ?? "");
  await consumeRate(`resend_${uid}_${memberId}`, 5, 24 * 60 * 60 * 1000, "Cette relance a atteint son plafond.");
  await assertVerifiedIfEmail(uid);
  const { data } = await requireOrganizer(eventId, uid);
  const members = await readMembers(eventId);
  const member = members.find((item) => item.id === memberId);
  if (!member) throw new HttpsError("not-found", "Ce participant est introuvable.");
  if (member.role === "organizer") throw new HttpsError("failed-precondition", "L'organisateur ne reçoit pas cette invitation.");
  if (member.status === "joined") throw new HttpsError("failed-precondition", "Cette personne a déjà accepté. Aucun nouveau lien n'est envoyé.");
  if (member.status === "pending") throw new HttpsError("failed-precondition", "Cette demande attend votre validation, pas un nouvel e-mail.");
  const privateSnap = await db.collection("events").doc(eventId).collection("memberPrivate").doc(memberId).get();
  const email = String(privateSnap.data()?.email ?? "");
  if (!email) throw new HttpsError("failed-precondition", "Aucune adresse n'est enregistrée pour cette personne. Ajoutez-la dans Participants.");
  const alreadySent = member.status === "invited" || privateSnap.data()?.inviteState === "pending" || privateSnap.data()?.inviteState === "revoked";
  const token = await issuePersonalToken(eventId, memberId);
  const url = `${appOrigin()}/invitation/${token}`;
  const sent = await db.collection("events").doc(eventId).collection("memberPrivate").doc(memberId).get();
  const theme = await loadTheme(eventId, data);
  const user = await adminAuth.getUser(uid);
  await queueEmail({
    idempotencyKey: `resend:${eventId}:${memberId}:${sent.data()?.tokenHash}`,
    to: email,
    uid: null,
    eventId,
    templateId: alreadySent ? "invite_resent" : "invitation",
    theme,
    vars: templateVars(data, member.displayName, await userName(uid), url),
    replyTo: theme.replyToEnabled && user.emailVerified ? user.email ?? "" : "",
  });
  if (member.status !== "invited") {
    await db.collection("events").doc(eventId).collection("members").doc(memberId).set({ status: "invited" }, { merge: true });
  }
  await audit(eventId, uid, "invites.resend");
  return { url, emailQueued: Boolean(email) };
});

export const revokeInvitation = callable(async (request, uid) => {
  const eventId = String((request.data as { eventId?: string })?.eventId ?? "");
  const memberId = String((request.data as { memberId?: string })?.memberId ?? "");
  await requireOrganizer(eventId, uid);
  const privateRef = db.collection("events").doc(eventId).collection("memberPrivate").doc(memberId);
  const snap = await privateRef.get();
  const hash = snap.data()?.tokenHash;
  if (typeof hash === "string") await db.collection("invitationTokens").doc(hash).set({ revoked: true }, { merge: true });
  await privateRef.set({ inviteState: "revoked", updatedAt: stamp() }, { merge: true });
  await audit(eventId, uid, "invites.revoke");
  return { ok: true };
});

export const inspectInvitation = callable(async (request) => {
  const token = String((request.data as { token?: string })?.token ?? "");
  if (token.length < 20 || token.length > 200) return { state: "invalid" as const };
  const hash = await sha256Hex(token);
  const snap = await db.collection("invitationTokens").doc(hash).get();
  const record = snap.exists
    ? {
        revoked: Boolean(snap.data()?.revoked),
        expiresAt: Number(snap.data()?.expiresAt ?? 0),
        claimedByUid: (snap.data()?.claimedByUid as string | null) ?? null,
      }
    : null;
  const state = inspectInvitationState(record, Date.now(), request.auth?.uid);
  if (!snap.exists || !record) return { state };
  const eventSnap = await db.collection("events").doc(String(snap.data()?.eventId)).get();
  const memberSnap = await db.collection("events").doc(String(snap.data()?.eventId)).collection("members").doc(String(snap.data()?.memberId)).get();
  let organizer = "L'organisateur";
  if (eventSnap.exists) organizer = await userName(String(eventSnap.data()?.organizerUid));
  return {
    state,
    eventName: eventSnap.data()?.name ?? "Échange",
    memberName: memberSnap.data()?.displayName ?? "Participant",
    organizerName: organizer,
    expiresAt: record.expiresAt,
  };
}, { auth: false });

export const acceptInvitation = callable(async (request, uid) => {
  const token = String((request.data as { token?: string })?.token ?? "");
  const hash = await sha256Hex(token);
  const ref = db.collection("invitationTokens").doc(hash);
  const result = await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) return { error: "Cette invitation est introuvable." };
    const data = snap.data() ?? {};
    const state = inspectInvitationState(
      {
        revoked: Boolean(data.revoked),
        expiresAt: Number(data.expiresAt ?? 0),
        claimedByUid: (data.claimedByUid as string | null) ?? null,
      },
      Date.now(),
      uid,
    );
    if (!canClaim(state)) return { error: state === "expired" ? "Ce lien a expiré." : state === "revoked" ? "Ce lien a été révoqué." : "Cette invitation a déjà été utilisée." };
    if (state === "valid") tx.update(ref, { claimedByUid: uid, claimedAt: stamp() });
    return { eventId: String(data.eventId), memberId: String(data.memberId) };
  });
  if ("error" in result && result.error) throw new HttpsError("failed-precondition", result.error);
  const eventId = result.eventId as string;
  const memberId = result.memberId as string;
  await db.collection("events").doc(eventId).collection("members").doc(memberId).set({ status: "joined" }, { merge: true });
  await db.collection("events").doc(eventId).collection("memberPrivate").doc(memberId).set({ inviteState: "accepted", updatedAt: stamp() }, { merge: true });
  const event = await db.collection("events").doc(eventId).get();
  const member = (await readMembers(eventId)).find((item) => item.id === memberId);
  const managed = (await readMembers(eventId)).filter((item) => item.managedByMemberId === memberId).map((item) => item.id);
  await db.collection("events").doc(eventId).collection("memberIndex").doc(uid).set({
    uid,
    memberId,
    eventId,
    eventName: event.data()?.name ?? "Échange",
    role: member?.role === "organizer" ? "organizer" : "participant",
    status: "joined",
    managedMemberIds: managed,
    updatedAt: stamp(),
  });
  await materializeMember(eventId, memberId, uid);
  await audit(eventId, uid, "invites.accept");
  return { eventId, memberId };
});

export const rotateJoinCode = callable(async (request, uid) => {
  const eventId = String((request.data as { eventId?: string })?.eventId ?? "");
  const { ref, data } = await requireOrganizer(eventId, uid);
  if (data.joinPolicy === "closed") throw new HttpsError("failed-precondition", "Les inscriptions sont closes.");
  const code = randomJoinCode();
  const hash = await sha256Hex(code);
  const vault = ref.collection("organizerVault").doc("join");
  const previous = await vault.get();
  if (previous.data()?.hash) await db.collection("joinCodes").doc(String(previous.data()?.hash)).delete();
  await db.collection("joinCodes").doc(hash).set({ eventId, active: true, createdAt: stamp() });
  await vault.set({ hash, code, updatedAt: stamp() });
  return { code, url: `${appOrigin()}/rejoindre/${code}` };
});

export const requestJoin = callable(async (request, uid) => {
  const code = String((request.data as { code?: string })?.code ?? "").trim().toUpperCase();
  const displayName = String((request.data as { displayName?: string })?.displayName ?? "").trim();
  if (displayName.length < 1 || displayName.length > 80) throw new HttpsError("invalid-argument", "Indiquez un prénom ou un pseudonyme.");
  await consumeRate(`join_${uid}`, 10, 60 * 60 * 1000, "Trop de demandes. Réessayez plus tard.");
  const hash = await sha256Hex(code);
  const codeSnap = await db.collection("joinCodes").doc(hash).get();
  if (!codeSnap.exists || codeSnap.data()?.active === false) throw new HttpsError("not-found", "Ce lien d'inscription n'est plus valable.");
  const eventId = String(codeSnap.data()?.eventId);
  const event = await db.collection("events").doc(eventId).get();
  if (!event.exists) throw new HttpsError("not-found", "Cet échange est introuvable.");
  const policy = String(event.data()?.joinPolicy ?? "approval");
  if (policy === "closed" || !["draft", "registration_open", "ready"].includes(String(event.data()?.status))) {
    throw new HttpsError("failed-precondition", "Les inscriptions sont closes.");
  }
  const pending = await db.collection("events").doc(eventId).collection("members").where("status", "==", "pending").get();
  if (pending.size >= 100) throw new HttpsError("resource-exhausted", "Trop de demandes sont en attente.");
  const existingIndex = await db.collection("events").doc(eventId).collection("memberIndex").doc(uid).get();
  if (existingIndex.exists) return { eventId, status: "joined", eventName: event.data()?.name ?? "Échange" };
  const memberId = newId();
  const status = policy === "open" ? "joined" : "pending";
  const eventRef = db.collection("events").doc(eventId);
  await db.runTransaction(async (tx) => {
    const roster = await tx.get(eventRef.collection("members"));
    const fit = rosterDecision(participantCount(roster.docs.map((doc) => doc.data())) + 1, readCommercial(event.data() ?? {}).offerId);
    if (!fit.ok) throw new HttpsError("failed-precondition", fit.message);
    tx.set(eventRef.collection("members").doc(memberId), {
      displayName,
      status,
      role: "participant",
      managedByMemberId: null,
      groupLabel: "",
      updatedAt: stamp(),
    });
    tx.set(eventRef.collection("memberPrivate").doc(memberId), {
      requestUid: uid,
      email: "",
      inviteState: status === "joined" ? "accepted" : "pending",
      updatedAt: stamp(),
    });
    if (status === "joined") {
      tx.set(eventRef.collection("memberIndex").doc(uid), {
        uid,
        memberId,
        eventId,
        eventName: event.data()?.name ?? "Échange",
        role: "participant",
        status: "joined",
        managedMemberIds: [],
        updatedAt: stamp(),
      });
    }
  });
  await audit(eventId, uid, status === "joined" ? "join.open" : "join.request");
  return { eventId, status, eventName: event.data()?.name ?? "Échange" };
});

export const reviewJoin = callable(async (request, uid) => {
  const eventId = String((request.data as { eventId?: string })?.eventId ?? "");
  const memberId = String((request.data as { memberId?: string })?.memberId ?? "");
  const decision = String((request.data as { decision?: string })?.decision ?? "");
  await requireOrganizer(eventId, uid);
  if (decision === "refuse") {
    await db.collection("events").doc(eventId).collection("members").doc(memberId).set({ status: "declined" }, { merge: true });
    return { status: "declined" };
  }
  if (decision !== "approve") throw new HttpsError("invalid-argument", "Décision inconnue.");
  const eventSnap = await db.collection("events").doc(eventId).get();
  const roster = await db.collection("events").doc(eventId).collection("members").get();
  const row = roster.docs.find((doc) => doc.id === memberId)?.data();
  const counted = Boolean(row && row.status !== "declined");
  const nextCount = participantCount(roster.docs.map((doc) => doc.data())) + (counted ? 0 : 1);
  const fit = rosterDecision(nextCount, readCommercial(eventSnap.data() ?? {}).offerId);
  if (!fit.ok) throw new HttpsError("failed-precondition", fit.message);
  const member = await db.collection("events").doc(eventId).collection("members").doc(memberId).get();
  if (!member.exists) throw new HttpsError("not-found", "Cette demande est introuvable.");
  const secret = await db.collection("events").doc(eventId).collection("memberPrivate").doc(memberId).get();
  const requestUid = String(secret.data()?.requestUid ?? "");
  await db.collection("events").doc(eventId).collection("members").doc(memberId).set({ status: "joined" }, { merge: true });
  if (requestUid) {
    const event = await db.collection("events").doc(eventId).get();
    await db.collection("events").doc(eventId).collection("memberIndex").doc(requestUid).set({
      uid: requestUid,
      memberId,
      eventId,
      eventName: event.data()?.name ?? "Échange",
      role: "participant",
      status: "joined",
      managedMemberIds: [],
      updatedAt: stamp(),
    });
    await materializeMember(eventId, memberId, requestUid);
  }
  await audit(eventId, uid, "join.approve");
  return { status: "approved" };
});

async function adminEmail(uid: string): Promise<string | null> {
  const user = await adminAuth.getUser(uid);
  return user.emailVerified ? user.email ?? null : null;
}
