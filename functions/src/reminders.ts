import type { DocumentData } from "firebase-admin/firestore";
import { canRemindView, canRemindWishes } from "../../shared/reminders";
import { appOrigin, db, userName } from "./admin";
import { queueEmail } from "./mail";
import { loadTheme, templateVars } from "./theme";

const BATCH = 15;
const MAX_NEW = 25;

export async function queueEligibleReminders(now = Date.now()): Promise<number> {
  let sent = 0;
  sent += await walk("drawn", "view", now, sent);
  if (sent >= MAX_NEW) return sent;
  sent += await walk("registration_open", "wishes", now, sent);
  if (sent >= MAX_NEW) return sent;
  sent += await walk("ready", "wishes", now, sent);
  return sent;
}

async function walk(status: string, kind: "view" | "wishes", now: number, already: number): Promise<number> {
  const events = await db.collection("events").where("status", "==", status).limit(BATCH).get();
  let sent = 0;
  for (const event of events.docs) {
    if (already + sent >= MAX_NEW) break;
    sent += await remindEvent(event.id, event.data(), kind, now, MAX_NEW - already - sent);
  }
  return sent;
}

async function remindEvent(eventId: string, data: DocumentData, kind: "view" | "wishes", now: number, room: number): Promise<number> {
  if (room <= 0) return 0;
  const starts = data.startsAt?.toDate?.() as Date | undefined;
  const startsAt = starts ? starts.getTime() : null;
  const people = await db.collection("events").doc(eventId).collection("members").limit(40).get();
  const privates = await db.collection("events").doc(eventId).collection("memberPrivate").get();
  const index = await db.collection("events").doc(eventId).collection("memberIndex").get();
  const uidByMember = new Map<string, string>();
  index.docs.forEach((doc) => uidByMember.set(String(doc.data().memberId ?? ""), doc.id));
  const theme = await loadTheme(eventId, data);
  const organizer = await userName(String(data.organizerUid ?? ""));
  let sent = 0;
  for (const person of people.docs) {
    if (sent >= room) break;
    const secret = privates.docs.find((doc) => doc.id === person.id)?.data() ?? {};
    const email = String(secret.email ?? "");
    if (!email) continue;
    const declined = String(person.data().status ?? "") === "declined" || String(secret.inviteState ?? "") === "purged";
    const eligible = kind === "view"
      ? canRemindView({ status: String(data.status), discovered: Boolean(secret.discoveredAt), declined, startsAt, now })
      : canRemindWishes({ status: String(data.status), filled: secret.wishesFilled === true, declined, startsAt, now });
    if (!eligible) continue;
    const uid = uidByMember.get(person.id) ?? null;
    const status = await queueEmail({
      idempotencyKey: `${kind}:${eventId}:${person.id}`,
      to: email,
      uid,
      eventId,
      templateId: kind === "view" ? "reminder_view" : "reminder_wishes",
      theme,
      vars: templateVars(data, String(person.data().displayName ?? ""), organizer, `${appOrigin()}/participations/${eventId}`),
    });
    if (status !== "duplicate" && status !== "skipped") sent += 1;
  }
  return sent;
}
