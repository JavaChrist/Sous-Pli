import { FieldValue } from "firebase-admin/firestore";
import { HttpsError } from "firebase-functions/v2/https";
import { appConfig } from "../../shared/config";
import type { EmailTheme, TemplateId } from "../../shared/email/templates";
import { TEMPLATE_VERSION, templateChannel } from "../../shared/email/templates";
import { renderEmail, sanitizeHeader, type TemplateVars } from "../../shared/email/render";
import { sha256Hex } from "../../shared/invites";
import { db, localLinksAllowed, stamp } from "./admin";

interface QueueEmailInput {
  idempotencyKey: string;
  to: string;
  uid: string | null;
  eventId: string;
  templateId: TemplateId;
  theme: EmailTheme;
  vars: TemplateVars;
  replyTo?: string;
  scrubRecipient?: boolean;
}

export async function queueEmail(input: QueueEmailInput): Promise<string> {
  if (!input.to.trim()) return "skipped";
  if (!(await wantsMessage(input.uid, input.templateId))) return "skipped";
  const id = (await sha256Hex(input.idempotencyKey)).slice(0, 40);
  const ref = db.collection("mailOutbox").doc(id);
  const existing = await ref.get();
  if (existing.exists) return "duplicate";
  const { lien, ...rest } = input.vars;
  await ref.set({
    to: input.to.trim(),
    uid: input.uid,
    eventId: input.eventId,
    templateId: input.templateId,
    templateVersion: TEMPLATE_VERSION,
    themeSnapshot: input.theme,
    vars: rest,
    replyTo: input.replyTo ?? "",
    scrubRecipient: input.scrubRecipient === true,
    status: "pending",
    attempts: 0,
    nextAttemptAt: Date.now(),
    createdAt: stamp(),
  });
  await db.collection("mailSecrets").doc(id).set({ lien: lien ?? "" });
  await processOutbox(id);
  const done = await ref.get();
  return String(done.data()?.status ?? "pending");
}

export async function processOutbox(id: string): Promise<void> {
  const ref = db.collection("mailOutbox").doc(id);
  const snap = await ref.get();
  if (!snap.exists) return;
  const data = snap.data() as OutboxDoc;
  if (data.status === "sent" || data.status === "captured_locally" || data.status === "skipped") return;
  if (Number(data.attempts ?? 0) >= 5) return;
  const secret = await db.collection("mailSecrets").doc(id).get();
  const lien = String(secret.data()?.lien ?? "");
  try {
    const rendered = renderEmail(
      data.themeSnapshot,
      data.templateId,
      { ...data.vars, lien },
      { allowLocalHttp: localLinksAllowed() },
    );
    const status = await deliver({
      to: data.to,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
      fromName: data.themeSnapshot.fromName || appConfig.name,
      replyTo: data.replyTo,
      eventId: data.eventId,
      templateId: data.templateId,
      scrubRecipient: data.scrubRecipient === true,
    });
    await ref.update({
      status,
      to: data.scrubRecipient === true ? "" : data.to,
      attempts: Number(data.attempts ?? 0) + 1,
      sentAt: stamp(),
      lastError: "",
      retainUntil: Date.now() + 90 * 24 * 60 * 60 * 1000,
    });
    await secret.ref.delete().catch(() => undefined);
  } catch (error) {
    const attempts = Number(data.attempts ?? 0) + 1;
    await ref.update({
      status: attempts >= 5 ? "failed" : "pending",
      attempts,
      nextAttemptAt: Date.now() + attempts * 15 * 60 * 1000,
      lastError: error instanceof Error ? error.message.slice(0, 180) : "échec",
    });
  }
}

export async function processDueMail(limit = 20): Promise<void> {
  const due = await db.collection("mailOutbox").where("status", "==", "pending").limit(limit).get();
  for (const doc of due.docs) {
    const nextAttemptAt = Number(doc.data().nextAttemptAt ?? 0);
    if (nextAttemptAt <= Date.now()) await processOutbox(doc.id);
  }
}

async function wantsMessage(uid: string | null, templateId: TemplateId): Promise<boolean> {
  const channel = templateChannel(templateId);
  if (channel === "essential" || !uid) return true;
  const snap = await db.collection("users").doc(uid).get();
  const prefs = (snap.data()?.preferences ?? {}) as { notifyReminders?: boolean; notifyActivity?: boolean };
  if (channel === "reminder") return prefs.notifyReminders !== false;
  return prefs.notifyActivity !== false;
}

interface OutboxDoc {
  to: string;
  templateId: TemplateId;
  themeSnapshot: EmailTheme;
  vars: TemplateVars;
  replyTo?: string;
  status: string;
  attempts?: number;
  eventId: string;
  scrubRecipient?: boolean;
}

async function deliver(message: {
  to: string;
  subject: string;
  html: string;
  text: string;
  fromName: string;
  replyTo?: string;
  eventId: string;
  templateId: string;
  scrubRecipient?: boolean;
}): Promise<"sent" | "captured_locally"> {
  const fromAddress = process.env.MAIL_FROM_ADDRESS || "";
  const key = process.env.RESEND_API_KEY || "";
  const fromName = sanitizeHeader(message.fromName, 80) || appConfig.name;
  if (!key) {
    await db.collection("mailCapture").add({
      to: message.scrubRecipient ? "" : message.to,
      subject: message.subject,
      html: message.html,
      text: message.text,
      eventId: message.eventId,
      templateId: message.templateId,
      status: "captured_locally",
      retainUntil: Date.now() + 90 * 24 * 60 * 60 * 1000,
      createdAt: FieldValue.serverTimestamp(),
    });
    return "captured_locally";
  }
  if (!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(fromAddress)) {
    throw new HttpsError("failed-precondition", "L'adresse d'expédition n'est pas configurée.");
  }
  const payload: Record<string, unknown> = {
    from: `${fromName} <${fromAddress}>`,
    to: [message.to],
    subject: message.subject,
    html: message.html,
    text: message.text,
  };
  if (message.replyTo && /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(message.replyTo)) payload.reply_to = message.replyTo;
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error(`Le prestataire a répondu ${response.status}.`);
  return "sent";
}
