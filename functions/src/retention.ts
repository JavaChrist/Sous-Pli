import { Timestamp, type DocumentData } from "firebase-admin/firestore";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { HttpsError } from "firebase-functions/v2/https";
import { appConfig } from "../../shared/config";
import { serviceTheme } from "../../shared/email/templates";
import {
  accountPhase,
  draftPhase,
  invitationPurgeAt,
  retentionPhase,
} from "../../shared/retention";
import { formatInZone } from "../../shared/time";
import { adminAuth, appOrigin, bucket, callable, db, stamp, userName } from "./admin";
import { eraseAccount } from "./erasure";
import { queueEmail } from "./mail";

const PAGE = 20;

export const retentionWorker = onSchedule({ schedule: "every day 09:15", region: "europe-west1", timeZone: "Europe/Paris", memory: "256MiB", cpu: 0.167, maxInstances: 1 }, async () => {
  await runRetention(process.env.RETENTION_APPLY === "true");
});

export const previewRetention = callable(async (_request, uid) => {
  const emulator = process.env.FUNCTIONS_EMULATOR === "true";
  const operators = (process.env.MOLLIE_OPERATOR_UIDS || "").split(",").map((item) => item.trim());
  if (!emulator && !operators.includes(uid)) {
    throw new HttpsError("permission-denied", "L'aperçu de conservation est réservé à une personne habilitée.");
  }
  return runRetention(false);
});

export async function runRetention(apply: boolean) {
  const now = new Date();
  const events = await scanEvents(now, apply);
  const drafts = await scanDrafts(now, apply);
  const invites = await scanInvitations(now, apply);
  const accounts = await scanAccounts(now, apply);
  const mail = await scanMail(now, apply);
  const audits = await scanAudits(now, apply);
  const wishes = await inventoryWishFiles();
  const report = { apply, at: now.toISOString(), events, drafts, invites, accounts, mail, audits, wishes };
  await db.collection("retentionReports").add({ ...report, createdAt: stamp() });
  return report;
}

async function scanEvents(now: Date, apply: boolean) {
  const dueBefore = Timestamp.fromDate(new Date(now.getTime() + 31 * 24 * 60 * 60 * 1000));
  const snap = await db.collection("events").where("accessUntil", "<=", dueBefore).orderBy("accessUntil").limit(PAGE).get();
  const items = [];
  for (const doc of snap.docs) {
    const accessUntil = doc.data().accessUntil?.toDate?.() as Date | undefined;
    if (!accessUntil) continue;
    const phase = retentionPhase(accessUntil, now);
    if (phase === "open") continue;
    items.push({ id: doc.id, phase });
    if (!apply) continue;
    if (phase === "warning" && !doc.data().retentionWarnedAt) {
      await warnEvent(doc.id, doc.data(), accessUntil);
      await doc.ref.set({ retentionWarnedAt: stamp() }, { merge: true });
    }
    if (phase === "due") await purgeEvent(doc.id);
  }
  return items;
}

async function scanDrafts(now: Date, apply: boolean) {
  const cutoff = new Date(now.getTime());
  cutoff.setUTCMonth(cutoff.getUTCMonth() - 5);
  const snap = await db.collection("events").where("status", "==", "draft").where("updatedAt", "<=", Timestamp.fromDate(cutoff)).limit(PAGE).get();
  const items = [];
  for (const doc of snap.docs) {
    const updatedAt = doc.data().updatedAt?.toDate?.() as Date | undefined;
    if (!updatedAt) continue;
    const phase = draftPhase(updatedAt, now);
    if (phase === "keep") continue;
    items.push({ id: doc.id, phase });
    if (!apply) continue;
    if (phase === "warn" && !doc.data().draftWarnedAt) {
      await warnDraft(doc.id, doc.data());
      await doc.ref.set({ draftWarnedAt: stamp() }, { merge: true });
    }
    if (phase === "delete") await purgeEvent(doc.id);
  }
  return items;
}

async function scanInvitations(now: Date, apply: boolean) {
  const snap = await db.collection("invitationTokens").where("expiresAt", "<=", now.getTime() - 60 * 24 * 60 * 60 * 1000).limit(PAGE).get();
  const items = snap.docs.map((doc) => ({ id: doc.id, purgeAt: invitationPurgeAt(Number(doc.data().expiresAt ?? 0)) }));
  if (apply) {
    for (const doc of snap.docs) await doc.ref.delete();
  }
  return items;
}

async function scanAccounts(now: Date, apply: boolean) {
  const cutoff = new Date(now.getTime());
  cutoff.setUTCMonth(cutoff.getUTCMonth() - 24);
  const snap = await db.collection("users").where("lastSeenAt", "<=", Timestamp.fromDate(cutoff)).limit(PAGE).get();
  const items = [];
  for (const doc of snap.docs) {
    const lastSeenAt = doc.data().lastSeenAt?.toDate?.() as Date | undefined;
    if (!lastSeenAt) continue;
    const warnedAt = doc.data().inactiveWarnedAt?.toDate?.() as Date | undefined;
    const phase = accountPhase({ lastSeenAt, warnedAt: warnedAt ?? null, now });
    if (phase === "keep") continue;
    items.push({ id: doc.id, phase });
    if (!apply) continue;
    if (phase === "warn" && !warnedAt) {
      await warnAccount(doc.id, String(doc.data().email ?? ""));
      await doc.ref.set({ inactiveWarnedAt: stamp() }, { merge: true });
    }
    if (phase === "delete") {
      const result = await eraseAccount(doc.id, true);
      items[items.length - 1] = { id: doc.id, phase, blocked: result.blocked };
    }
  }
  return items;
}

async function scanMail(now: Date, apply: boolean) {
  const snap = await db.collection("mailOutbox").where("retainUntil", "<=", now.getTime()).limit(PAGE).get();
  if (apply) {
    for (const doc of snap.docs) {
      await db.collection("mailSecrets").doc(doc.id).delete();
      await doc.ref.delete();
    }
    const captured = await db.collection("mailCapture").where("retainUntil", "<=", now.getTime()).limit(PAGE).get();
    for (const doc of captured.docs) await doc.ref.delete();
  }
  return { outbox: snap.size };
}

async function scanAudits(now: Date, apply: boolean) {
  const cutoff = new Date(now.getTime());
  cutoff.setUTCMonth(cutoff.getUTCMonth() - 6);
  const snap = await db.collectionGroup("audit").where("at", "<=", Timestamp.fromDate(cutoff)).orderBy("at").limit(PAGE).get();
  if (apply) {
    for (const doc of snap.docs) await doc.ref.delete();
  }
  return { count: snap.size };
}

async function inventoryWishFiles() {
  const [files] = await bucket.getFiles({ prefix: "events/", maxResults: 50, autoPaginate: false });
  return files.filter((file) => file.name.includes("/wishes/")).map((file) => file.name);
}

async function purgeEvent(eventId: string) {
  const tokens = await db.collection("invitationTokens").where("eventId", "==", eventId).limit(100).get();
  for (const doc of tokens.docs) await doc.ref.delete();
  const codes = await db.collection("joinCodes").where("eventId", "==", eventId).limit(20).get();
  for (const doc of codes.docs) await doc.ref.delete();
  for (const group of ["assignments", "threads", "notifications"] as const) {
    const copies = await db.collectionGroup(group).where("eventId", "==", eventId).limit(100).get();
    for (const doc of copies.docs) await doc.ref.delete();
  }
  const [files] = await bucket.getFiles({ prefix: `events/${eventId}/`, maxResults: 100, autoPaginate: false });
  await Promise.all(files.map((file) => file.delete({ ignoreNotFound: true })));
  await db.recursiveDelete(db.collection("events").doc(eventId));
}

async function warnEvent(eventId: string, data: DocumentData, accessUntil: Date) {
  const email = await organizerEmail(String(data.organizerUid ?? ""));
  if (!email) return;
  const zone = String(data.timeZone ?? appConfig.defaultTimeZone);
  const when = formatInZone(accessUntil, zone);
  await queueEmail({
    idempotencyKey: `retention:${eventId}:${accessUntil.toISOString()}`,
    to: email,
    uid: String(data.organizerUid ?? ""),
    eventId,
    templateId: "retention_warning",
    theme: serviceTheme(),
    vars: {
      prenom: await userName(String(data.organizerUid ?? "")),
      evenement: String(data.name ?? "Échange"),
      organisateur: appConfig.name,
      date: when.date,
      heure: when.time,
      lien: `${appOrigin()}/evenements/${eventId}`,
      signature: appConfig.name,
    },
  });
}

async function warnDraft(eventId: string, data: DocumentData) {
  const email = await organizerEmail(String(data.organizerUid ?? ""));
  if (!email) return;
  await queueEmail({
    idempotencyKey: `draft:${eventId}`,
    to: email,
    uid: String(data.organizerUid ?? ""),
    eventId,
    templateId: "draft_warning",
    theme: serviceTheme(),
    vars: {
      prenom: await userName(String(data.organizerUid ?? "")),
      evenement: String(data.name ?? "Brouillon"),
      organisateur: appConfig.name,
      date: String(data.localDate ?? ""),
      heure: String(data.localTime ?? ""),
      lien: `${appOrigin()}/evenements/${eventId}`,
      signature: appConfig.name,
    },
  });
}

async function warnAccount(uid: string, email: string) {
  if (!email) return;
  await queueEmail({
    idempotencyKey: `inactive:${uid}`,
    to: email,
    uid,
    eventId: "",
    templateId: "account_inactive",
    theme: serviceTheme(),
    vars: {
      prenom: await userName(uid),
      evenement: appConfig.name,
      organisateur: appConfig.name,
      date: "",
      heure: "",
      lien: `${appOrigin()}/profil`,
      signature: appConfig.name,
    },
  });
}

async function organizerEmail(uid: string): Promise<string> {
  try {
    return (await adminAuth.getUser(uid)).email ?? "";
  } catch {
    return "";
  }
}
