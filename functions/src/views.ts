import type { DocumentData } from "firebase-admin/firestore";
import type { PrivacyMode } from "../../shared/domain";
import { db, stamp } from "./admin";
import { readMembers, type MemberRecord } from "./events";

export interface StoredAssignment {
  giverId: string;
  recipientId: string;
  slot: number;
  threadId: string;
}

export async function memberUids(eventId: string): Promise<Map<string, string>> {
  const snap = await db.collection("events").doc(eventId).collection("memberIndex").get();
  const map = new Map<string, string>();
  snap.docs.forEach((doc) => map.set(String(doc.data().memberId), doc.id));
  return map;
}

export async function writeParticipantViews(input: {
  eventId: string;
  drawVersion: number;
  privacyMode: PrivacyMode;
  revealed: boolean;
  members: MemberRecord[];
  assignments: StoredAssignment[];
  giverIds?: Set<string>;
  preserveProgress?: boolean;
}) {
  const names = new Map(input.members.map((member) => [member.id, member.displayName]));
  const uids = await memberUids(input.eventId);
  const showIdentity = input.privacyMode !== "double_blind" || input.revealed;
  const grouped = new Map<string, StoredAssignment[]>();
  for (const edge of input.assignments) {
    const list = grouped.get(edge.giverId) ?? [];
    list.push(edge);
    grouped.set(edge.giverId, list);
  }

  for (const [giverId, edges] of grouped) {
    if (input.giverIds && !input.giverIds.has(giverId)) continue;
    const slots = edges
      .sort((a, b) => a.slot - b.slot)
      .map((edge) => ({
        slot: edge.slot,
        label: showIdentity ? names.get(edge.recipientId) ?? "Participant" : `Destinataire ${edge.slot}`,
        recipientMemberId: showIdentity ? edge.recipientId : null,
        threadId: edge.threadId,
        handedOver: false,
      }));
    const giver = input.members.find((member) => member.id === giverId);
    const targets: Array<{ uid: string; docId: string; managedFor: string | null }> = [];
    const ownUid = uids.get(giverId);
    if (ownUid) targets.push({ uid: ownUid, docId: input.eventId, managedFor: null });
    if (giver?.managedByMemberId) {
      const managerUid = uids.get(giver.managedByMemberId);
      if (managerUid) targets.push({ uid: managerUid, docId: `${input.eventId}_${giverId}`, managedFor: giver.displayName });
    }
    for (const target of targets) {
      const ref = db.collection("users").doc(target.uid).collection("assignments").doc(target.docId);
      let discoveredAt: unknown = null;
      if (input.preserveProgress) {
        const previous = await ref.get();
        discoveredAt = previous.data()?.discoveredAt ?? null;
        const previousSlots = (previous.data()?.slots ?? []) as Array<{ threadId?: string; handedOver?: boolean }>;
        for (const slot of slots) {
          const match = previousSlots.find((item) => item.threadId === slot.threadId);
          if (match?.handedOver) slot.handedOver = true;
        }
      }
      await ref.set({
        eventId: input.eventId,
        memberId: giverId,
        drawVersion: input.drawVersion,
        privacyMode: input.privacyMode,
        discoveredAt,
        managedFor: target.managedFor,
        slots,
        updatedAt: stamp(),
      });
    }
  }

  if (showIdentity) {
    for (const [giverId, edges] of grouped) {
      const uid = uids.get(giverId);
      if (!uid) continue;
      await db.collection("events").doc(input.eventId).collection("wishAccess").doc(uid).set({
        memberIds: edges.map((edge) => edge.recipientId),
      });
    }
  }
}

export async function writeThreads(input: {
  eventId: string;
  privacyMode: PrivacyMode;
  revealed: boolean;
  members: MemberRecord[];
  assignments: StoredAssignment[];
}) {
  const names = new Map(input.members.map((member) => [member.id, member.displayName]));
  const uids = await memberUids(input.eventId);
  const showGiver = input.privacyMode === "public" || input.revealed;
  const showRecipient = input.privacyMode !== "double_blind" || input.revealed;
  for (const edge of input.assignments) {
    const giverUid = uids.get(edge.giverId) ?? null;
    const recipientUid = uids.get(edge.recipientId) ?? null;
    await db.collection("events").doc(input.eventId).collection("serverThreads").doc(edge.threadId).set({
      giverMemberId: edge.giverId,
      recipientMemberId: edge.recipientId,
      giverUid,
      recipientUid,
      slot: edge.slot,
      blockedBy: [],
      eventId: input.eventId,
    });
    if (giverUid) {
      await db.collection("users").doc(giverUid).collection("threads").doc(edge.threadId).set({
        eventId: input.eventId,
        label: showRecipient ? names.get(edge.recipientId) ?? "Participant" : `Destinataire ${edge.slot}`,
        unread: 0,
        role: "giver",
        updatedAt: stamp(),
      });
    }
    if (recipientUid) {
      await db.collection("users").doc(recipientUid).collection("threads").doc(edge.threadId).set({
        eventId: input.eventId,
        label: showGiver ? names.get(edge.giverId) ?? "Participant" : "Votre correspondant",
        unread: 0,
        role: "recipient",
        updatedAt: stamp(),
      });
    }
  }
}

export async function copyWishes(eventId: string, privacyMode: PrivacyMode, revealed: boolean, members: MemberRecord[], assignments: StoredAssignment[]) {
  const show = privacyMode !== "double_blind" || revealed;
  const names = new Map(members.map((member) => [member.id, member.displayName]));
  const uids = await memberUids(eventId);
  const wishSnap = await db.collection("events").doc(eventId).collection("wishlists").get();
  const wishes = new Map(wishSnap.docs.map((doc) => [doc.id, doc.data()]));
  const grouped = new Map<string, StoredAssignment[]>();
  for (const edge of assignments) {
    const list = grouped.get(edge.giverId) ?? [];
    list.push(edge);
    grouped.set(edge.giverId, list);
  }
  for (const [giverId, edges] of grouped) {
    const uid = uids.get(giverId);
    if (!uid) continue;
    await db.collection("users").doc(uid).collection("recipientWishes").doc(eventId).set({
      eventId,
      slots: edges.map((edge) => {
        const wish = wishes.get(edge.recipientId) ?? {};
        return {
          slot: edge.slot,
          label: show ? names.get(edge.recipientId) ?? "Participant" : `Destinataire ${edge.slot}`,
          items: wish.items ?? [],
          sizes: wish.sizes ?? "",
          avoid: wish.avoid ?? "",
        };
      }),
      updatedAt: stamp(),
    });
  }
}

export async function materializeMember(eventId: string, memberId: string, uid: string) {
  const eventSnap = await db.collection("events").doc(eventId).get();
  const status = String(eventSnap.data()?.status ?? "");
  if (!["drawn", "revealed", "archived"].includes(status)) return;
  const drawSnap = await db.collection("events").doc(eventId).collection("serverData").doc("draw").get();
  if (!drawSnap.exists) return;
  const assignments = (drawSnap.data()?.assignments ?? []) as StoredAssignment[];
  const members = await readMembers(eventId);
  const privacyMode = (eventSnap.data()?.privacyMode ?? "classic") as PrivacyMode;
  const revealed = status === "revealed" || status === "archived";
  const managedIds = members.filter((member) => member.managedByMemberId === memberId).map((member) => member.id);
  const giverIds = new Set([memberId, ...managedIds]);
  await writeParticipantViews({
    eventId,
    drawVersion: Number(drawSnap.data()?.version ?? 1),
    privacyMode,
    revealed,
    members,
    assignments: assignments.filter((edge) => giverIds.has(edge.giverId)),
    preserveProgress: true,
  });
  const names = new Map(members.map((member) => [member.id, member.displayName]));
  const relevant = assignments.filter((edge) => giverIds.has(edge.giverId) || edge.recipientId === memberId);
  for (const edge of relevant) {
    const threadRef = db.collection("users").doc(uid).collection("threads").doc(edge.threadId);
    if ((await threadRef.get()).exists) continue;
    const isGiver = giverIds.has(edge.giverId);
    const showRecipient = privacyMode !== "double_blind" || revealed;
    const showGiver = privacyMode === "public" || revealed;
    await threadRef.set({
      eventId,
      label: isGiver
        ? showRecipient
          ? names.get(edge.recipientId) ?? "Participant"
          : `Destinataire ${edge.slot}`
        : showGiver
          ? names.get(edge.giverId) ?? "Participant"
          : "Votre correspondant",
      unread: 0,
      role: isGiver ? "giver" : "recipient",
      onBehalfOf: edge.giverId === memberId ? null : names.get(edge.giverId) ?? null,
      updatedAt: stamp(),
    });
    await db.collection("events").doc(eventId).collection("serverThreads").doc(edge.threadId).set(
      isGiver ? { giverUid: uid } : { recipientUid: uid },
      { merge: true },
    );
  }
  await copyWishes(
    eventId,
    privacyMode,
    revealed,
    members,
    assignments.filter((edge) => giverIds.has(edge.giverId)),
  );
}

export function namesOf(members: MemberRecord[]): Map<string, string> {
  return new Map(members.map((member) => [member.id, member.displayName]));
}

export function asDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === "object" && value && "toDate" in value && typeof (value as { toDate: () => Date }).toDate === "function") {
    return (value as { toDate: () => Date }).toDate();
  }
  return null;
}

export type { DocumentData };
