import { HttpsError } from "firebase-functions/v2/https";
import { Timestamp } from "firebase-admin/firestore";
import { CATALOG, readCommercial } from "../../shared/billing";
import { accessEndInstant } from "../../shared/retention";
import { canTransition, type EventStatus, type Exclusion } from "../../shared/domain";
import { appOrigin, callable, db, newId, stamp, userName } from "./admin";
import { audit } from "./audit";
import { readMembers, readPrivate, requireOrganizer } from "./events";
import { queueEmail } from "./mail";
import { loadTheme, templateVars } from "./theme";
import type { StoredAssignment } from "./views";

export const updatePracticalInfo = callable(async (request, uid) => {
  const eventId = String((request.data as { eventId?: string })?.eventId ?? "");
  const { ref, data } = await requireOrganizer(eventId, uid);
  if (["cancelled", "archived"].includes(String(data.status))) {
    throw new HttpsError("failed-precondition", "Cet échange ne se modifie plus.");
  }
  const place = String((request.data as { place?: string })?.place ?? data.place ?? "").slice(0, 160);
  const rulesText = String((request.data as { rulesText?: string })?.rulesText ?? data.rulesText ?? "").slice(0, 2000);
  const description = String((request.data as { description?: string })?.description ?? data.description ?? "").slice(0, 2000);
  await ref.update({ place, rulesText, description, updatedAt: stamp() });
  if (["drawn", "revealed"].includes(String(data.status))) {
    const theme = await loadTheme(eventId, { ...data, place, rulesText });
    const organizer = await userName(uid);
    const secrets = await readPrivate(eventId);
    const members = await readMembers(eventId);
    for (const member of members) {
      const email = String(secrets.get(member.id)?.email ?? "");
      if (!email) continue;
      await queueEmail({
        idempotencyKey: `info:${eventId}:${member.id}:${Date.now()}`,
        to: email,
        uid: null,
        eventId,
        templateId: "info_changed",
        theme,
        vars: templateVars({ ...data, place, rulesText }, member.displayName, organizer, `${appOrigin()}/participations/${eventId}`),
      });
    }
  }
  await audit(eventId, uid, "event.practical");
  return { ok: true };
});

export const duplicateEvent = callable(async (request, uid) => {
  const eventId = String((request.data as { eventId?: string })?.eventId ?? "");
  const { data } = await requireOrganizer(eventId, uid);
  const members = await readMembers(eventId);
  const secrets = await readPrivate(eventId);
  const draw = await db.collection("events").doc(eventId).collection("serverData").doc("draw").get();
  const history = ((draw.data()?.assignments ?? []) as StoredAssignment[]).map(
    (edge): Exclusion => ({ kind: "history", fromId: edge.giverId, toId: edge.recipientId }),
  );
  const nextId = newId();
  const ref = db.collection("events").doc(nextId);
  const commercial = readCommercial(data);
  const included = CATALOG[commercial.offerId].priceCents === 0;
  await ref.set({
    ...data,
    name: `${data.name} (reprise)`,
    status: "draft",
    offerId: commercial.offerId,
    commercialStatus: included ? "included" : "unpaid",
    paidOfferId: null,
    paidAmountCents: 0,
    commercialReference: null,
    accessUntil: data.localDate ? Timestamp.fromDate(accessEndInstant(String(data.localDate), String(data.timeZone ?? "Europe/Paris"))) : data.accessUntil ?? null,
    accessUntilLocked: false,
    retentionWarnedAt: null,
    draftWarnedAt: null,
    drawVersion: 0,
    idempotencyKey: null,
    launchReceipt: null,
    stats: { members: members.length, joined: 0, invited: 0, discovered: 0, wishes: 0, messages: 0 },
    createdAt: stamp(),
    updatedAt: stamp(),
  });
  for (const member of members) {
    await ref.collection("members").doc(member.id).set({
      displayName: member.displayName,
      status: member.role === "organizer" ? "joined" : "draft",
      role: member.role,
      managedByMemberId: member.managedByMemberId,
      groupLabel: member.groupLabel,
      updatedAt: stamp(),
    });
    await ref.collection("memberPrivate").doc(member.id).set({
      email: secrets.get(member.id)?.email ?? "",
      inviteState: "none",
      updatedAt: stamp(),
    });
  }
  if (data.organizerParticipates) {
    const organizer = members.find((member) => member.role === "organizer");
    if (organizer) {
      await ref.collection("memberIndex").doc(uid).set({
        uid,
        memberId: organizer.id,
        eventId: nextId,
        eventName: `${data.name} (reprise)`,
        role: "organizer",
        status: "joined",
        managedMemberIds: members.filter((member) => member.managedByMemberId === organizer.id).map((member) => member.id),
        updatedAt: stamp(),
      });
    }
  }
  const existing = await db.collection("events").doc(eventId).collection("constraints").get();
  for (const constraint of existing.docs) {
    const dataConstraint = constraint.data() as Exclusion;
    if (dataConstraint.kind === "history") continue;
    await ref.collection("constraints").doc(newId()).set(dataConstraint);
  }
  for (const constraint of history) {
    await ref.collection("constraints").doc(newId()).set(constraint);
  }
  await audit(nextId, uid, "event.duplicate");
  return { eventId: nextId, historyConstraints: history.length };
});

export const cancelEvent = callable(async (request, uid) => {
  const eventId = String((request.data as { eventId?: string })?.eventId ?? "");
  const confirmName = String((request.data as { confirmName?: string })?.confirmName ?? "");
  const { ref, data } = await requireOrganizer(eventId, uid);
  if (confirmName.trim() !== String(data.name)) {
    throw new HttpsError("failed-precondition", "Saisissez le nom exact de l'échange pour confirmer l'annulation.");
  }
  if (!canTransition(data.status as EventStatus, "cancelled") && data.status !== "draft") {
    throw new HttpsError("failed-precondition", "Cet échange ne peut pas être annulé.");
  }
  await ref.update({ status: "cancelled", updatedAt: stamp() });
  const theme = await loadTheme(eventId, data);
  const organizer = await userName(uid);
  const secrets = await readPrivate(eventId);
  const members = await readMembers(eventId);
  for (const member of members) {
    const email = String(secrets.get(member.id)?.email ?? "");
    if (!email) continue;
    await queueEmail({
      idempotencyKey: `cancel:${eventId}:${member.id}`,
      to: email,
      uid: null,
      eventId,
      templateId: "cancellation",
      theme,
      vars: templateVars(data, member.displayName, organizer, `${appOrigin()}/evenements`),
    });
  }
  await audit(eventId, uid, "event.cancel");
  return { status: "cancelled" };
});

export const archiveEvent = callable(async (request, uid) => {
  const eventId = String((request.data as { eventId?: string })?.eventId ?? "");
  const { ref, data } = await requireOrganizer(eventId, uid);
  if (!canTransition(data.status as EventStatus, "archived")) {
    throw new HttpsError("failed-precondition", "Seuls un tirage lancé ou révélé peut être archivé.");
  }
  await ref.update({ status: "archived", updatedAt: stamp() });
  await audit(eventId, uid, "event.archive");
  return { status: "archived" };
});

export const deleteEvent = callable(async (request, uid) => {
  const eventId = String((request.data as { eventId?: string })?.eventId ?? "");
  const confirmName = String((request.data as { confirmName?: string })?.confirmName ?? "");
  const { ref, data } = await requireOrganizer(eventId, uid);
  if (!["draft", "cancelled"].includes(String(data.status))) {
    throw new HttpsError("failed-precondition", "Annulez l'échange avant de le supprimer.");
  }
  if (confirmName.trim() !== String(data.name)) {
    throw new HttpsError("failed-precondition", "Saisissez le nom exact de l'échange pour confirmer la suppression.");
  }
  const tokens = await db.collection("invitationTokens").where("eventId", "==", eventId).get();
  for (const doc of tokens.docs) await doc.ref.delete();
  const codes = await db.collection("joinCodes").where("eventId", "==", eventId).get();
  for (const doc of codes.docs) await doc.ref.delete();
  await db.recursiveDelete(ref);
  return { ok: true };
});
