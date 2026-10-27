import { organizerCanCloseAccount } from "../../shared/retention";
import { adminAuth, bucket, db, stamp } from "./admin";

const CLOSED = new Set(["cancelled", "archived"]);

export interface EraseReport {
  uid: string;
  applied: boolean;
  blocked: string | null;
  memberships: number;
  wishPrefixes: string[];
}

export async function eraseAccount(uid: string, apply: boolean): Promise<EraseReport> {
  const events = await db.collection("events").where("organizerUid", "==", uid).get();
  const decision = organizerCanCloseAccount(events.docs.map((doc) => String(doc.data().status ?? "")));
  const report: EraseReport = { uid, applied: false, blocked: decision.ok ? null : decision.message, memberships: 0, wishPrefixes: [] };
  if (!decision.ok) return report;

  const user = await adminAuth.getUser(uid).catch(() => null);
  const email = user?.email?.toLowerCase() ?? "";
  const indexes = await db.collectionGroup("memberIndex").where("uid", "==", uid).limit(100).get();
  report.memberships = indexes.size;
  for (const index of indexes.docs) {
    const eventId = String(index.data().eventId ?? "");
    const memberId = String(index.data().memberId ?? "");
    const role = String(index.data().role ?? "");
    if (!eventId || !memberId) continue;
    report.wishPrefixes.push(`events/${eventId}/wishes/${memberId}/`);
    if (!apply) continue;
    if (role === "organizer") {
      await db.collection("events").doc(eventId).set({ organizerAccountDeleted: true, updatedAt: stamp() }, { merge: true });
      continue;
    }
    const event = await db.collection("events").doc(eventId).get();
    const status = String(event.data()?.status ?? "");
    const memberRef = db.collection("events").doc(eventId).collection("members").doc(memberId);
    const privateRef = db.collection("events").doc(eventId).collection("memberPrivate").doc(memberId);
    if (CLOSED.has(status) || status === "drawn" || status === "revealed") {
      await memberRef.set({ displayName: "Participant retiré", updatedAt: stamp() }, { merge: true });
      await privateRef.set({ email: "", tokenHash: "", inviteState: "purged", updatedAt: stamp() }, { merge: true });
    } else {
      await memberRef.delete();
      await privateRef.delete();
    }
    await index.ref.delete();
    await db.collection("events").doc(eventId).collection("wishlists").doc(memberId).delete();
    const ideas = await db.collection("events").doc(eventId).collection("giftIdeas").get();
    for (const idea of ideas.docs) {
      if (!apply) continue;
      if (String(idea.data().authorMemberId ?? "") === memberId) {
        await idea.ref.set({ authorName: "Participant retiré" }, { merge: true });
      }
      if (String(idea.data().aboutMemberId ?? "") === memberId && !CLOSED.has(status) && status !== "drawn" && status !== "revealed") {
        await idea.ref.delete();
      }
    }
    await deletePrefix(`events/${eventId}/wishes/${memberId}/`);
  }

  const threads = await db.collection("users").doc(uid).collection("threads").limit(100).get();
  for (const thread of threads.docs) {
    const eventId = String(thread.data().eventId ?? "");
    if (!eventId || !apply) continue;
    const server = await db.collection("events").doc(eventId).collection("serverThreads").doc(thread.id).get();
    const giverUid = String(server.data()?.giverUid ?? "");
    const recipientUid = String(server.data()?.recipientUid ?? "");
    const otherUid = uid === giverUid ? recipientUid : uid === recipientUid ? giverUid : "";
    if (!otherUid) continue;
    const incoming = await db.collection("users").doc(otherUid).collection("threads").doc(thread.id).collection("messages").where("direction", "==", "in").limit(100).get();
    for (const message of incoming.docs) {
      await message.ref.set({ senderAccountDeleted: true }, { merge: true });
    }
  }

  const coEvents = await db.collection("users").doc(uid).collection("coEvents").get();
  const pendingMail = await db.collection("mailOutbox").where("uid", "==", uid).where("status", "==", "pending").limit(50).get();
  if (!apply) return report;

  for (const co of coEvents.docs) {
    await db.collection("events").doc(co.id).collection("coOrganizers").doc(uid).delete();
  }
  for (const mail of pendingMail.docs) {
    await db.collection("mailSecrets").doc(mail.id).delete();
    await mail.ref.delete();
  }
  if (email) {
    const contacts = await db.collection("contactMessages").where("email", "==", email).limit(20).get();
    for (const contact of contacts.docs) await contact.ref.delete();
  }
  const tokens = await db.collection("invitationTokens").where("claimedByUid", "==", uid).limit(50).get();
  for (const token of tokens.docs) await token.ref.delete();
  await db.recursiveDelete(db.collection("users").doc(uid));
  if (user) await adminAuth.deleteUser(uid);
  report.applied = true;
  return report;
}

async function deletePrefix(prefix: string) {
  const [files] = await bucket.getFiles({ prefix, maxResults: 50 });
  await Promise.all(files.map((file) => file.delete({ ignoreNotFound: true })));
}
