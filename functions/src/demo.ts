import { Timestamp } from "firebase-admin/firestore";
import { HttpsError } from "firebase-functions/v2/https";
import { z } from "zod";
import { planPlayReviewEvents, PLAY_REVIEW_EVENT_NAMES, PLAY_REVIEW_PURPOSE, type DemoEventPlan } from "../../shared/demo";
import { accessEndInstant } from "../../shared/retention";
import { zonedLocalToUtc } from "../../shared/time";
import { adminAuth, callable, db, newId, parse, stamp } from "./admin";
import { audit } from "./audit";

const requestSchema = z.object({
  beneficiaryUid: z.string().regex(/^[A-Za-z0-9]{20,128}$/, "Le compte examinateur est absent ou illisible."),
}).strict();

function isOperator(uid: string): boolean {
  return (process.env.MOLLIE_OPERATOR_UIDS || "").split(",").map((item) => item.trim()).filter(Boolean).includes(uid);
}

function assertOperator(uid: string) {
  if (!isOperator(uid)) {
    throw new HttpsError("permission-denied", "Cette action est réservée à une personne habilitée. Aucun droit n'a été créé.");
  }
}

export const grantPlayReviewDemo = callable(async (request, uid) => {
  assertOperator(uid);
  const input = parse(requestSchema, request.data);
  try {
    await adminAuth.getUser(input.beneficiaryUid);
  } catch {
    throw new HttpsError("not-found", "Ce compte n'existe pas. Aucun droit n'a été créé.");
  }
  const plan = planPlayReviewEvents(input.beneficiaryUid, Date.now());
  if (!plan.ok) throw new HttpsError("failed-precondition", plan.reason);
  const existing = await db.collection("events").where("organizerUid", "==", input.beneficiaryUid).get();
  const named = existing.docs.filter((doc) => PLAY_REVIEW_EVENT_NAMES.includes(String(doc.data().name) as (typeof PLAY_REVIEW_EVENT_NAMES)[number]));
  const already = named.filter((doc) => doc.data().demoGrant?.purpose === PLAY_REVIEW_PURPOSE);
  if (named.length > 0 && already.length !== named.length) {
    throw new HttpsError("failed-precondition", "Ce titre est déjà utilisé. Aucun événement ni aucune commande n'a été modifié.");
  }
  if (already.length === plan.events.length) {
    return { created: false, eventIds: already.map((doc) => doc.id) };
  }
  if (named.length > 0) {
    throw new HttpsError("failed-precondition", "La démonstration est incomplète. Aucun document n'a été réécrit.");
  }

  const ids: string[] = [];
  for (const event of plan.events) {
    const eventId = newId();
    ids.push(eventId);
    await writeDemoEvent(eventId, input.beneficiaryUid, event);
    await audit(eventId, uid, "demo.grant");
  }
  return { created: true, eventIds: ids };
});

export const revokePlayReviewDemo = callable(async (request, uid) => {
  assertOperator(uid);
  const input = parse(requestSchema, request.data);
  const existing = await db.collection("events").where("organizerUid", "==", input.beneficiaryUid).get();
  const targets = existing.docs.filter((doc) => {
    const data = doc.data();
    return PLAY_REVIEW_EVENT_NAMES.includes(String(data.name) as (typeof PLAY_REVIEW_EVENT_NAMES)[number])
      && data.demoGrant?.purpose === PLAY_REVIEW_PURPOSE
      && data.demoGrant?.revokedAtMs == null;
  });
  for (const doc of targets) {
    await doc.ref.set({ demoGrant: { ...doc.data().demoGrant, revokedAtMs: Date.now() }, updatedAt: stamp() }, { merge: true });
    await audit(doc.id, uid, "demo.revoke");
  }
  return { revoked: targets.length };
});

async function writeDemoEvent(eventId: string, beneficiaryUid: string, event: DemoEventPlan) {
  const startsAt = zonedLocalToUtc(event.localDate, event.localTime, event.timeZone);
  const ref = db.collection("events").doc(eventId);
  const batch = db.batch();
  batch.set(ref, {
    name: event.name,
    occasion: "christmas",
    context: event.context,
    place: event.place,
    description: event.description,
    rulesText: "Un cadeau fictif par personne. Aucune invitation réelle.",
    localDate: event.localDate,
    localTime: event.localTime,
    timeZone: event.timeZone,
    startsAt: Timestamp.fromDate(startsAt),
    revealLocalDate: event.localDate,
    revealLocalTime: event.localTime,
    revealAt: Timestamp.fromDate(startsAt),
    budget: { min: 20, max: 20, currency: "EUR", handmade: false, secondHand: false },
    privacyMode: event.privacyMode,
    giftsPerPerson: event.giftsPerPerson,
    avoidReciprocal: event.avoidReciprocal,
    organizerParticipates: event.organizerParticipates,
    joinPolicy: "closed",
    organizationName: event.organizationName,
    teamName: "",
    offerId: event.offerId,
    commercialStatus: event.commercialStatus,
    paidOfferId: event.paidOfferId,
    paidAmountCents: event.paidAmountCents,
    commercialReference: event.commercialReference,
    organizerUid: beneficiaryUid,
    status: event.status,
    drawVersion: event.status === "drawn" ? 1 : 0,
    idempotencyKey: null,
    launchReceipt: event.status === "drawn" ? { assignmentCount: event.assignments.length, reciprocalPreferenceRelaxed: false, distribution: "randomized-backtracking" } : null,
    stats: {
      members: event.members.length,
      joined: event.members.filter((member) => member.status === "joined").length,
      invited: 0,
      discovered: 0,
      wishes: event.wishes.length,
      messages: event.messages.length,
    },
    accessUntil: Timestamp.fromDate(accessEndInstant(event.localDate, event.timeZone)),
    accessUntilLocked: false,
    demoGrant: event.demoGrant,
    createdAt: stamp(),
    updatedAt: stamp(),
  });
  for (const member of event.members) {
    batch.set(ref.collection("members").doc(member.id), {
      displayName: member.displayName,
      status: member.status,
      role: member.role,
      managedByMemberId: null,
      groupLabel: member.groupLabel,
      updatedAt: stamp(),
    });
    batch.set(ref.collection("memberPrivate").doc(member.id), {
      email: "",
      inviteState: "none",
      discoveredAt: null,
      wishesFilled: event.wishes.some((wish) => wish.memberId === member.id),
      updatedAt: stamp(),
    });
  }
  batch.set(ref.collection("memberIndex").doc(beneficiaryUid), {
    uid: beneficiaryUid,
    memberId: "m-examinateur",
    eventId,
    eventName: event.name,
    role: "organizer",
    status: "joined",
    managedMemberIds: [],
    updatedAt: stamp(),
  });
  for (const wish of event.wishes) {
    batch.set(ref.collection("wishlists").doc(wish.memberId), { items: wish.items, sizes: "", avoid: "", updatedAt: stamp() });
  }
  for (const co of event.coOrganizers) {
    batch.set(ref.collection("coOrganizers").doc(co.id), { displayName: co.displayName, email: "", participates: false, updatedAt: stamp() });
  }
  batch.set(ref.collection("teamProgress").doc("summary"), { teams: event.teams, updatedAt: stamp() });
  if (event.status === "drawn") {
    const own = event.assignments.find((edge) => edge.giverId === "m-examinateur");
    batch.set(ref.collection("serverData").doc("draw"), {
      version: 1,
      assignments: event.assignments,
      privacyMode: event.privacyMode,
      reciprocalPreferenceRelaxed: false,
      distribution: "randomized-backtracking",
      createdAt: stamp(),
    });
    if (own) {
      const recipient = event.members.find((member) => member.id === own.recipientId);
      batch.set(db.collection("users").doc(beneficiaryUid).collection("assignments").doc(eventId), {
        eventId,
        memberId: own.giverId,
        drawVersion: 1,
        privacyMode: event.privacyMode,
        discoveredAt: null,
        managedFor: null,
        slots: [{ slot: own.slot, label: recipient?.displayName ?? "Participant", recipientMemberId: own.recipientId, threadId: own.threadId, handedOver: false }],
        updatedAt: stamp(),
      });
      batch.set(db.collection("users").doc(beneficiaryUid).collection("threads").doc(own.threadId), {
        eventId,
        label: "Votre correspondant",
        unread: 1,
        role: "giver",
        updatedAt: stamp(),
      });
      batch.set(ref.collection("serverThreads").doc(own.threadId), {
        giverMemberId: own.giverId,
        recipientMemberId: own.recipientId,
        giverUid: beneficiaryUid,
        recipientUid: null,
        slot: own.slot,
        blockedBy: [],
        eventId,
      });
      const message = event.messages[0];
      if (message) {
        batch.set(db.collection("users").doc(beneficiaryUid).collection("threads").doc(own.threadId).collection("messages").doc(message.id), {
          body: message.body,
          direction: message.direction,
          fromLabel: message.fromLabel,
          createdAt: stamp(),
        });
      }
      batch.set(ref.collection("wishAccess").doc(beneficiaryUid), { memberIds: [own.recipientId] });
    }
  }
  await batch.commit();
}
