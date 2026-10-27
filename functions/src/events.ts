import { Timestamp, type DocumentData } from "firebase-admin/firestore";
import { HttpsError } from "firebase-functions/v2/https";
import { assertOfferForContext, defaultOffer, participantCount, readCommercial, rosterDecision } from "../../shared/billing";
import { limits } from "../../shared/config";
import { canEditRoster, canTransition, type EventStatus, type Exclusion } from "../../shared/domain";
import { constraintsInputSchema, eventInputSchema, membersInputSchema } from "../../shared/schemas";
import { nextAccessUntil, accessEndInstant } from "../../shared/retention";
import { zonedLocalToUtc } from "../../shared/time";
import { adminAuth, callable, db, newId, parse, stamp, userName } from "./admin";
import { audit } from "./audit";

export interface MemberRecord {
  id: string;
  displayName: string;
  status: string;
  role: "organizer" | "participant" | "managed";
  managedByMemberId: string | null;
  groupLabel: string;
}

export async function requireOrganizer(eventId: string, uid: string) {
  const ref = db.collection("events").doc(eventId);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError("not-found", "Cet échange est introuvable.");
  const data = snap.data() ?? {};
  if (data.organizerUid === uid) return { ref, data };
  const coOrganizer = await ref.collection("coOrganizers").doc(uid).get();
  if (coOrganizer.exists) return { ref, data };
  throw new HttpsError("permission-denied", "Seul l'organisateur peut faire cette action.");
}

export async function readMembers(eventId: string): Promise<MemberRecord[]> {
  const snap = await db.collection("events").doc(eventId).collection("members").get();
  return snap.docs.map((doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      displayName: String(data.displayName ?? ""),
      status: String(data.status ?? "draft"),
      role: (data.role as MemberRecord["role"]) ?? "participant",
      managedByMemberId: (data.managedByMemberId as string | null) ?? null,
      groupLabel: String(data.groupLabel ?? ""),
    };
  });
}

export async function readConstraints(eventId: string): Promise<Exclusion[]> {
  const snap = await db.collection("events").doc(eventId).collection("constraints").get();
  return snap.docs.map((doc) => doc.data() as Exclusion);
}

export async function readPrivate(eventId: string) {
  const snap = await db.collection("events").doc(eventId).collection("memberPrivate").get();
  const map = new Map<string, DocumentData>();
  snap.docs.forEach((doc) => map.set(doc.id, doc.data()));
  return map;
}

export const upsertEvent = callable(async (request, uid) => {
  const input = parse(eventInputSchema, request.data);
  let startsAt: Date;
  let revealAt: Date;
  try {
    startsAt = zonedLocalToUtc(input.localDate, input.localTime, input.timeZone);
    revealAt = zonedLocalToUtc(input.revealLocalDate, input.revealLocalTime, input.timeZone);
  } catch {
    throw new HttpsError("invalid-argument", "La date ou le fuseau horaire est invalide.");
  }
  const payload = {
    name: input.name,
    occasion: input.occasion,
    context: input.context,
    place: input.place,
    description: input.description,
    rulesText: input.rulesText,
    localDate: input.localDate,
    localTime: input.localTime,
    timeZone: input.timeZone,
    startsAt: Timestamp.fromDate(startsAt),
    revealLocalDate: input.revealLocalDate,
    revealLocalTime: input.revealLocalTime,
    revealAt: Timestamp.fromDate(revealAt),
    budget: input.budget,
    privacyMode: input.privacyMode,
    giftsPerPerson: input.giftsPerPerson,
    avoidReciprocal: input.avoidReciprocal,
    organizerParticipates: input.organizerParticipates,
    joinPolicy: input.joinPolicy,
    organizationName: input.organizationName,
    teamName: input.teamName,
    updatedAt: stamp(),
  };

  if (!input.eventId) {
    const existing = await db.collection("events").where("organizerUid", "==", uid).count().get();
    if (existing.data().count >= limits.maxEventsPerOrganizer) {
      throw new HttpsError("resource-exhausted", "La limite d'échanges pour ce compte est atteinte.");
    }
    const offerId = input.offerId ?? defaultOffer(input.context);
    const mismatch = assertOfferForContext(input.context, offerId);
    if (mismatch) throw new HttpsError("failed-precondition", mismatch);
    const ref = db.collection("events").doc(newId());
    await ref.set({
      ...payload,
      offerId,
      commercialStatus: offerId === "family" ? "included" : "unpaid",
      paidOfferId: null,
      paidAmountCents: 0,
      commercialReference: null,
      organizerUid: uid,
      status: "draft",
      drawVersion: 0,
      idempotencyKey: null,
      launchReceipt: null,
      stats: { members: 0, joined: 0, invited: 0, discovered: 0, wishes: 0, messages: 0 },
      accessUntil: Timestamp.fromDate(accessEndInstant(input.localDate, input.timeZone)),
      accessUntilLocked: false,
      createdAt: stamp(),
    });
    await audit(ref.id, uid, "event.create");
    return { eventId: ref.id };
  }

  const { ref, data } = await requireOrganizer(input.eventId, uid);
  const status = data.status as EventStatus;
  if (!canEditRoster(status) && status !== "drawn" && status !== "revealed") {
    throw new HttpsError("failed-precondition", "Cet échange ne peut plus être modifié.");
  }
  if (status === "drawn" || status === "revealed") {
    throw new HttpsError(
      "failed-precondition",
      "Le tirage est lancé. Modifiez le lieu, le budget ou les consignes depuis les informations pratiques.",
    );
  }
  if (data.privacyMode !== input.privacyMode && status !== "draft") {
    throw new HttpsError("failed-precondition", "Le mode de confidentialité se choisit avant l'ouverture, puis il reste fixe.");
  }
  const access = nextAccessUntil({
    currentUntil: data.accessUntil?.toDate?.() ?? null,
    locked: data.accessUntilLocked === true,
    nextLocalDate: input.localDate,
    timeZone: input.timeZone,
  });
  if (access.refused) throw new HttpsError("failed-precondition", access.refused);
  await ref.update({ ...payload, accessUntil: Timestamp.fromDate(access.until) });
  await renameIndexes(ref.id, input.name);
  await audit(ref.id, uid, "event.update");
  return { eventId: ref.id };
});

export const setMembers = callable(async (request, uid) => {
  const input = parse(membersInputSchema, request.data);
  const { ref, data } = await requireOrganizer(input.eventId, uid);
  if (!canEditRoster(data.status as EventStatus)) {
    throw new HttpsError("failed-precondition", "Les participants ne se modifient plus librement après le tirage.");
  }
  const user = await adminAuth.getUser(uid);
  const existing = await readMembers(input.eventId);
  const organizerExisting = existing.find((member) => member.role === "organizer");
  const kept = new Map(existing.map((member) => [member.id, member]));
  const next: Array<MemberRecord & { email: string }> = [];

  if (data.organizerParticipates) {
    next.push({
      id: organizerExisting?.id ?? newId(),
      displayName: await userName(uid),
      status: "joined",
      role: "organizer",
      managedByMemberId: null,
      groupLabel: "",
      email: user.email ?? "",
    });
  }

  const seenEmail = new Set(next.map((member) => member.email.toLowerCase()).filter(Boolean));
  for (const member of input.members) {
    if (member.memberId && member.memberId === organizerExisting?.id) continue;
    const email = member.email.trim().toLowerCase();
    if (email && seenEmail.has(email)) {
      throw new HttpsError("invalid-argument", "Deux participants ne peuvent pas partager la même adresse.");
    }
    if (email) seenEmail.add(email);
    const id = member.memberId && kept.has(member.memberId) && kept.get(member.memberId)?.role !== "organizer"
      ? member.memberId
      : member.memberId && !kept.has(member.memberId)
        ? member.memberId
        : newId();
    if (next.some((item) => item.id === id)) continue;
    next.push({
      id,
      displayName: member.displayName,
      status: kept.get(id)?.status === "joined" ? "joined" : kept.get(id)?.status === "invited" ? "invited" : "draft",
      role: "participant",
      managedByMemberId: member.managedByMemberId ?? null,
      groupLabel: member.groupLabel,
      email,
    });
  }

  if (next.length > limits.maxMembers) {
    throw new HttpsError("resource-exhausted", `Le groupe compte ${next.length} personnes. Le plafond technique est ${limits.maxMembers}. Personne n'a été retiré.`);
  }
  const fit = rosterDecision(participantCount(next), readCommercial(data).offerId);
  if (!fit.ok) throw new HttpsError("failed-precondition", fit.message);
  const ids = new Set(next.map((member) => member.id));
  for (const member of next) {
    if (!member.managedByMemberId) continue;
    if (member.managedByMemberId === member.id || !ids.has(member.managedByMemberId)) {
      throw new HttpsError("invalid-argument", "L'adulte responsable doit faire partie du groupe.");
    }
    const manager = next.find((item) => item.id === member.managedByMemberId);
    if (manager?.managedByMemberId) {
      throw new HttpsError("invalid-argument", "Un participant déjà représenté ne peut pas représenter quelqu'un d'autre.");
    }
    member.role = "managed";
  }

  const batch = db.batch();
  const privateSnap = await db.collection("events").doc(input.eventId).collection("memberPrivate").get();
  const previousPrivate = new Map(privateSnap.docs.map((doc) => [doc.id, doc.data()]));
  for (const member of existing) {
    if (!ids.has(member.id)) {
      batch.delete(ref.collection("members").doc(member.id));
      batch.delete(ref.collection("memberPrivate").doc(member.id));
    }
  }
  const indexSnap = await ref.collection("memberIndex").get();
  for (const doc of indexSnap.docs) batch.delete(doc.ref);

  const managed = new Map<string, string[]>();
  for (const member of next) {
    if (member.managedByMemberId) {
      const list = managed.get(member.managedByMemberId) ?? [];
      list.push(member.id);
      managed.set(member.managedByMemberId, list);
    }
  }

  for (const member of next) {
    batch.set(ref.collection("members").doc(member.id), {
      displayName: member.displayName,
      status: member.status,
      role: member.role,
      managedByMemberId: member.managedByMemberId,
      groupLabel: member.groupLabel,
      updatedAt: stamp(),
    });
    const previous = previousPrivate.get(member.id) ?? {};
    batch.set(ref.collection("memberPrivate").doc(member.id), {
      email: member.email,
      inviteState: previous.inviteState ?? "none",
      discoveredAt: previous.discoveredAt ?? null,
      wishesFilled: previous.wishesFilled ?? false,
      updatedAt: stamp(),
    });
  }

  const joinedUid = new Map<string, string>();
  if (data.organizerParticipates) joinedUid.set(next[0]!.id, uid);
  for (const doc of indexSnap.docs) {
    const memberId = String(doc.data().memberId ?? "");
    if (ids.has(memberId) && doc.id !== uid) joinedUid.set(memberId, doc.id);
  }
  for (const [memberId, memberUid] of joinedUid) {
    const member = next.find((item) => item.id === memberId);
    if (!member || member.role === "managed") continue;
    batch.set(ref.collection("memberIndex").doc(memberUid), {
      uid: memberUid,
      memberId,
      eventId: ref.id,
      eventName: data.name,
      role: member.role,
      status: member.status,
      managedMemberIds: managed.get(memberId) ?? [],
      updatedAt: stamp(),
    });
  }

  const joined = next.filter((member) => member.status === "joined").length;
  const invited = next.filter((member) => member.status === "invited").length;
  batch.update(ref, {
    stats: {
      ...(data.stats ?? {}),
      members: next.length,
      joined,
      invited,
    },
    updatedAt: stamp(),
  });
  await batch.commit();
  await dropBrokenConstraints(ref.id, ids);
  await audit(ref.id, uid, "members.replace");
  await refreshTeamProgress(input.eventId);
  return { count: next.length };
});

export const setConstraints = callable(async (request, uid) => {
  const input = parse(constraintsInputSchema, request.data);
  const { data } = await requireOrganizer(input.eventId, uid);
  if (!canEditRoster(data.status as EventStatus)) {
    throw new HttpsError("failed-precondition", "Les exclusions ne se modifient plus librement après le tirage.");
  }
  const members = await readMembers(input.eventId);
  const ids = new Set(members.map((member) => member.id));
  for (const constraint of input.constraints) {
    const referenced = constraint.kind === "group"
      ? constraint.memberIds
      : constraint.kind === "reciprocal"
        ? [constraint.aId, constraint.bId]
        : [constraint.fromId, constraint.toId];
    if (referenced.some((id) => !ids.has(id))) {
      throw new HttpsError("invalid-argument", "Une exclusion cite une personne absente du groupe.");
    }
  }
  const ref = db.collection("events").doc(input.eventId).collection("constraints");
  const existing = await ref.get();
  const batch = db.batch();
  existing.docs.forEach((doc) => batch.delete(doc.ref));
  input.constraints.forEach((constraint) => batch.set(ref.doc(newId()), constraint));
  if (typeof input.avoidPriorPairs === "boolean") {
    batch.update(db.collection("events").doc(input.eventId), { avoidPriorPairs: input.avoidPriorPairs, updatedAt: stamp() });
  }
  await batch.commit();
  await audit(input.eventId, uid, "constraints.replace");
  return { count: input.constraints.length };
});

export const setEventStatus = callable(async (request, uid) => {
  const eventId = String((request.data as { eventId?: string })?.eventId ?? "");
  const status = String((request.data as { status?: string })?.status ?? "") as EventStatus;
  const { ref, data } = await requireOrganizer(eventId, uid);
  if (!canTransition(data.status as EventStatus, status)) {
    throw new HttpsError("failed-precondition", "Ce changement d'étape n'est pas permis.");
  }
  await ref.update({ status, updatedAt: stamp() });
  await audit(eventId, uid, `status.${status}`);
  return { status };
});

export async function refreshTeamProgress(eventId: string) {
  const event = await db.collection("events").doc(eventId).get();
  if (readCommercial(event.data() ?? {}).offerId !== "business_plus") return;
  const members = await readMembers(eventId);
  const secrets = await readPrivate(eventId);
  const groups = new Map<string, { members: number; discovered: number }>();
  for (const member of members) {
    if (member.status === "declined") continue;
    const label = member.groupLabel || "Sans équipe";
    const row = groups.get(label) ?? { members: 0, discovered: 0 };
    row.members += 1;
    if (secrets.get(member.id)?.discoveredAt) row.discovered += 1;
    groups.set(label, row);
  }
  await db.collection("events").doc(eventId).collection("teamProgress").doc("summary").set({
    teams: [...groups.entries()].map(([label, row]) => ({ label, ...row })),
    updatedAt: stamp(),
  });
}

async function renameIndexes(eventId: string, eventName: string) {
  const snap = await db.collection("events").doc(eventId).collection("memberIndex").get();
  if (snap.empty) return;
  const batch = db.batch();
  snap.docs.forEach((doc) => batch.update(doc.ref, { eventName, updatedAt: stamp() }));
  await batch.commit();
}

async function dropBrokenConstraints(eventId: string, ids: Set<string>) {
  const ref = db.collection("events").doc(eventId).collection("constraints");
  const existing = await ref.get();
  const batch = db.batch();
  let changed = false;
  for (const doc of existing.docs) {
    const constraint = doc.data() as Exclusion;
    const referenced = constraint.kind === "group"
      ? constraint.memberIds
      : constraint.kind === "reciprocal"
        ? [constraint.aId, constraint.bId]
        : [constraint.fromId, constraint.toId];
    if (referenced.some((id) => !ids.has(id))) {
      batch.delete(doc.ref);
      changed = true;
    }
  }
  if (changed) await batch.commit();
}
