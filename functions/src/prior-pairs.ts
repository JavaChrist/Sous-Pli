import type { DocumentData } from "firebase-admin/firestore";
import type { Exclusion } from "../../shared/domain";
import { historyFromPast, personToken, type PastPair, type RosterPerson } from "../../shared/draw/prior";
import { db } from "./admin";
import type { MemberRecord } from "./events";

export async function priorDrawExclusions(
  organizerUid: string,
  eventId: string,
  members: MemberRecord[],
  secrets: Map<string, DocumentData>,
): Promise<Exclusion[]> {
  const current: RosterPerson[] = members.map((member) => ({
    memberId: member.id,
    email: String(secrets.get(member.id)?.email ?? ""),
    name: member.displayName,
  }));
  const events = await db.collection("events").where("organizerUid", "==", organizerUid).get();
  const past: PastPair[] = [];
  for (const event of events.docs) {
    if (event.id === eventId) continue;
    const status = String(event.data().status ?? "");
    if (status !== "drawn" && status !== "revealed" && status !== "archived") continue;
    const draw = await event.ref.collection("serverData").doc("draw").get();
    const assignments = (draw.data()?.assignments ?? []) as Array<{ giverId?: string; recipientId?: string }>;
    if (!assignments.length) continue;
    const pastMembers = await event.ref.collection("members").get();
    const pastPrivate = await event.ref.collection("memberPrivate").get();
    const emails = new Map(pastPrivate.docs.map((item) => [item.id, String(item.data().email ?? "")]));
    const names = new Map(pastMembers.docs.map((item) => [item.id, String(item.data().displayName ?? "")]));
    for (const edge of assignments) {
      const fromToken = personToken(emails.get(String(edge.giverId ?? "")) ?? "", names.get(String(edge.giverId ?? "")) ?? "");
      const toToken = personToken(emails.get(String(edge.recipientId ?? "")) ?? "", names.get(String(edge.recipientId ?? "")) ?? "");
      if (fromToken && toToken) past.push({ fromToken, toToken });
    }
  }
  return historyFromPast(current, past);
}
