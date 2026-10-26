import { FieldValue } from "firebase-admin/firestore";
import { HttpsError } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { z } from "zod";
import { publisher } from "../../shared/publisher";
import { adminAuth, callable, consumeRate, db, stamp } from "./admin";
import { eraseAccount } from "./erasure";
import { queueDeletionNotice } from "./auth-mail";
import { processDueMail } from "./mail";
import { queueEligibleReminders } from "./reminders";

const profileSchema = z.object({
  displayName: z.string().trim().min(1).max(80),
});

const preferencesSchema = z.object({
  notifyReminders: z.boolean(),
  notifyActivity: z.boolean(),
});

export const ensureProfile = callable(async (request, uid) => {
  const user = await adminAuth.getUser(uid);
  const accepted = (request.data as { acceptedTerms?: boolean } | undefined)?.acceptedTerms === true;
  const ref = db.collection("users").doc(uid);
  const snap = await ref.get();
  const terms = accepted ? { termsVersion: publisher.termsVersion, termsAcceptedAt: stamp() } : {};
  if (!snap.exists) {
    await ref.set({
      displayName: user.displayName || "Participant",
      email: user.email || "",
      preferences: { notifyReminders: true, notifyActivity: true },
      lastSeenAt: stamp(),
      ...terms,
      createdAt: stamp(),
    });
  } else {
    await ref.set({
      email: user.email || snap.data()?.email || "",
      lastSeenAt: stamp(),
      inactiveWarnedAt: FieldValue.delete(),
      ...terms,
      updatedAt: stamp(),
    }, { merge: true });
  }
  return { ok: true };
});

export const updatePreferences = callable(async (request, uid) => {
  const displayName = profileSchema.safeParse({ displayName: (request.data as { displayName?: string })?.displayName });
  const preferences = preferencesSchema.safeParse((request.data as { preferences?: unknown })?.preferences);
  if (!displayName.success || !preferences.success) {
    throw new HttpsError("invalid-argument", "Profil incomplet.");
  }
  await db.collection("users").doc(uid).set(
    { displayName: displayName.data.displayName, preferences: preferences.data, updatedAt: stamp() },
    { merge: true },
  );
  return { ok: true };
});

export const registerPushToken = callable(async (request, uid) => {
  const token = String((request.data as { token?: string })?.token ?? "");
  const platform = String((request.data as { platform?: string })?.platform ?? "web").slice(0, 40);
  if (token.length < 20 || token.length > 4096) throw new HttpsError("invalid-argument", "Jeton de notification invalide.");
  const id = (await (await import("../../shared/invites")).sha256Hex(token)).slice(0, 40);
  await db.collection("users").doc(uid).collection("pushTokens").doc(id).set({ token, platform, updatedAt: stamp() });
  return { ok: true };
});

export const removePushToken = callable(async (request, uid) => {
  const token = String((request.data as { token?: string })?.token ?? "");
  const id = (await (await import("../../shared/invites")).sha256Hex(token)).slice(0, 40);
  await db.collection("users").doc(uid).collection("pushTokens").doc(id).delete();
  return { ok: true };
});

export const exportMyData = callable(async (_request, uid) => {
  const user = await db.collection("users").doc(uid).get();
  const assignments = await db.collection("users").doc(uid).collection("assignments").get();
  const notifications = await db.collection("users").doc(uid).collection("notifications").get();
  const threads = await db.collection("users").doc(uid).collection("threads").get();
  const messages = [];
  for (const thread of threads.docs) {
    const list = await thread.ref.collection("messages").get();
    messages.push({ threadId: thread.id, label: thread.data().label, items: list.docs.map((doc) => doc.data()) });
  }
  return {
    profile: user.data() ?? {},
    assignments: assignments.docs.map((doc) => doc.data()),
    notifications: notifications.docs.map((doc) => doc.data()),
    messages,
  };
});

export const deleteAccount = callable(async (request, uid) => {
  const confirm = String((request.data as { confirm?: string })?.confirm ?? "");
  if (confirm !== "SUPPRIMER") throw new HttpsError("failed-precondition", "Saisissez SUPPRIMER pour confirmer.");
  const user = await adminAuth.getUser(uid).catch(() => null);
  const email = user?.email ?? "";
  const prenom = user?.displayName || "Bonjour";
  const result = await eraseAccount(uid, true);
  if (result.blocked) throw new HttpsError("failed-precondition", result.blocked);
  if (result.applied) await queueDeletionNotice(uid, email, prenom);
  return { status: "deleted" };
});

export const submitContact = callable(async (request) => {
  const name = String((request.data as { name?: string })?.name ?? "").trim().slice(0, 80);
  const email = String((request.data as { email?: string })?.email ?? "").trim().slice(0, 160);
  const message = String((request.data as { message?: string })?.message ?? "").trim().slice(0, 2000);
  if (!name || !email || message.length < 10) throw new HttpsError("invalid-argument", "Le message est incomplet.");
  await consumeRate(`contact_${email.toLowerCase()}`, 5, 60 * 60 * 1000, "Trop de messages. Réessayez plus tard.");
  await db.collection("contactMessages").add({ name, email, message, createdAt: stamp() });
  return { ok: true, status: "recorded" };
}, { auth: false });

export const listCapturedMail = callable(async (request, uid) => {
  if (process.env.FUNCTIONS_EMULATOR !== "true") {
    throw new HttpsError("permission-denied", "La boîte locale n'existe qu'avec les émulateurs.");
  }
  const eventId = String((request.data as { eventId?: string })?.eventId ?? "");
  const event = await db.collection("events").doc(eventId).get();
  if (event.data()?.organizerUid !== uid) throw new HttpsError("permission-denied", "Seul l'organisateur peut lire la boîte locale.");
  const snap = await db.collection("mailCapture").where("eventId", "==", eventId).limit(30).get();
  return {
    status: "captured_locally",
    messages: snap.docs.map((doc) => ({ id: doc.id, to: doc.data().to, subject: doc.data().subject, html: doc.data().html, text: doc.data().text })),
  };
});

export const mailWorker = onSchedule({ schedule: "every 15 minutes", region: "europe-west1", timeZone: "Europe/Paris", memory: "256MiB", cpu: 0.167, maxInstances: 1 }, async () => {
  await processDueMail(30);
});

export const reminderWorker = onSchedule({ schedule: "every day 08:00", region: "europe-west1", timeZone: "Europe/Paris", memory: "256MiB", cpu: 0.167, maxInstances: 1 }, async () => {
  await queueEligibleReminders();
  const events = await db.collection("events").where("status", "==", "drawn").limit(40).get();
  for (const event of events.docs) {
    const starts = event.data().startsAt?.toDate?.() as Date | undefined;
    if (!starts) continue;
    const days = (starts.getTime() - Date.now()) / 86400000;
    if (days < 0 || days > 3) continue;
    const members = await event.ref.collection("memberPrivate").get();
    const { queueEmail } = await import("./mail");
    const { loadTheme, templateVars } = await import("./theme");
    const { appOrigin, userName } = await import("./admin");
    const theme = await loadTheme(event.id, event.data());
    const organizer = await userName(String(event.data().organizerUid));
    const people = await event.ref.collection("members").get();
    for (const person of people.docs) {
      const secret = members.docs.find((doc) => doc.id === person.id);
      const email = String(secret?.data().email ?? "");
      if (!email) continue;
      await queueEmail({
        idempotencyKey: `reminder:${event.id}:${person.id}:${starts.toISOString().slice(0, 10)}`,
        to: email,
        uid: null,
        eventId: event.id,
        templateId: "reminder_event",
        theme,
        vars: templateVars(event.data(), String(person.data().displayName ?? ""), organizer, `${appOrigin()}/participations/${event.id}`),
      });
    }
  }
});
