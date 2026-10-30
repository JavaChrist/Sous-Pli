import { HttpsError } from "firebase-functions/v2/https";
import { limits } from "../../shared/config";
import { emailOfferRights, readCommercial } from "../../shared/billing";
import { isBrandLogoUrl } from "../../shared/email/brand";
import { emailThemeSchema, messageSchema, wishlistSchema } from "../../shared/schemas";
import { PREVIEW_VARS, renderEmail } from "../../shared/email/render";
import { EVENT_TEMPLATE_IDS, TEMPLATE_IDS } from "../../shared/email/templates";
import { appOrigin, assertVerifiedIfEmail, callable, consumeRate, db, localLinksAllowed, newId, stamp } from "./admin";
import { audit } from "./audit";
import { requireOrganizer } from "./events";
import { queueEmail } from "./mail";
import { loadTheme } from "./theme";
import { copyWishes, type StoredAssignment } from "./views";
import { readMembers } from "./events";

async function memberContext(eventId: string, uid: string) {
  const index = await db.collection("events").doc(eventId).collection("memberIndex").doc(uid).get();
  if (!index.exists) throw new HttpsError("permission-denied", "Vous ne participez pas à cet échange.");
  return index.data() ?? {};
}

export const saveWishlist = callable(async (request, uid) => {
  const input = parseWishlist(request.data);
  const context = await memberContext(input.eventId, uid);
  const memberId = String(context.memberId);
  await db.collection("events").doc(input.eventId).collection("wishlists").doc(memberId).set({
    items: input.items,
    sizes: input.sizes,
    avoid: input.avoid,
    updatedAt: stamp(),
  });
  await db.collection("events").doc(input.eventId).collection("memberPrivate").doc(memberId).set(
    { wishesFilled: input.items.length > 0, updatedAt: stamp() },
    { merge: true },
  );
  const event = await db.collection("events").doc(input.eventId).get();
  if (["drawn", "revealed", "archived"].includes(String(event.data()?.status))) {
    const draw = await db.collection("events").doc(input.eventId).collection("serverData").doc("draw").get();
    const assignments = (draw.data()?.assignments ?? []) as StoredAssignment[];
    const members = await readMembers(input.eventId);
    await copyWishes(input.eventId, event.data()?.privacyMode, event.data()?.status !== "drawn", members, assignments);
  }
  return { ok: true };
});

function parseWishlist(data: unknown) {
  const result = wishlistSchema.safeParse(data);
  if (!result.success) throw new HttpsError("invalid-argument", result.error.issues[0]?.message ?? "Liste invalide.");
  return result.data;
}

export const getWishImage = callable(async (request, uid) => {
  const eventId = String((request.data as { eventId?: string })?.eventId ?? "");
  const memberId = String((request.data as { memberId?: string })?.memberId ?? "");
  const fileName = String((request.data as { fileName?: string })?.fileName ?? "");
  if (!/^[a-zA-Z0-9._-]{1,80}$/.test(fileName)) throw new HttpsError("invalid-argument", "Fichier invalide.");
  const event = await db.collection("events").doc(eventId).get();
  if (!event.exists) throw new HttpsError("not-found", "Échange introuvable.");
  const index = await db.collection("events").doc(eventId).collection("memberIndex").doc(uid).get();
  const isOrganizer = event.data()?.organizerUid === uid;
  const owns = index.data()?.memberId === memberId;
  let allowed = isOrganizer || owns;
  if (!allowed && index.exists) {
    const revealed = event.data()?.status === "revealed" || event.data()?.privacyMode !== "double_blind";
    if (revealed) {
      const access = await db.collection("events").doc(eventId).collection("wishAccess").doc(uid).get();
      const ids = (access.data()?.memberIds ?? []) as string[];
      allowed = ids.includes(memberId);
    }
  }
  if (!allowed) throw new HttpsError("permission-denied", "Cette image ne vous est pas accessible.");
  const { bucket } = await import("./admin");
  const file = bucket.file(`events/${eventId}/wishes/${memberId}/${fileName}`);
  const [exists] = await file.exists();
  if (!exists) throw new HttpsError("not-found", "Image introuvable.");
  const [buffer] = await file.download();
  if (buffer.length > limits.maxImageBytes) throw new HttpsError("resource-exhausted", "Image trop volumineuse.");
  const [metadata] = await file.getMetadata();
  const contentType = String(metadata.contentType ?? "");
  if (!/^image\/(jpeg|png|webp)$/.test(contentType)) throw new HttpsError("failed-precondition", "Cette photo n'est pas une image acceptée.");
  return { contentType, base64: buffer.toString("base64") };
});

export const sendMessage = callable(async (request, uid) => {
  const input = messageSchema.safeParse(request.data);
  if (!input.success) throw new HttpsError("invalid-argument", input.error.issues[0]?.message ?? "Message invalide.");
  await consumeRate(`msg_${uid}`, limits.messagesPerWindow, limits.messageWindowMs, "Trop de messages. Patientez quelques minutes.");
  const threadRef = db.collection("users").doc(uid).collection("threads").doc(input.data.threadId);
  const thread = await threadRef.get();
  if (!thread.exists || thread.data()?.eventId !== input.data.eventId) {
    throw new HttpsError("permission-denied", "Cette conversation ne vous est pas accessible.");
  }
  const server = await db.collection("events").doc(input.data.eventId).collection("serverThreads").doc(input.data.threadId).get();
  if (!server.exists) throw new HttpsError("not-found", "Conversation introuvable.");
  const blocked = (server.data()?.blockedBy ?? []) as string[];
  if (blocked.includes(uid)) throw new HttpsError("failed-precondition", "Cette conversation est bloquée.");
  const event = await db.collection("events").doc(input.data.eventId).get();
  if (!["drawn", "revealed"].includes(String(event.data()?.status))) {
    throw new HttpsError("failed-precondition", "La messagerie n'est pas ouverte.");
  }
  const giverUid = String(server.data()?.giverUid ?? "");
  const recipientUid = String(server.data()?.recipientUid ?? "");
  const otherUid = uid === giverUid ? recipientUid : uid === recipientUid ? giverUid : "";
  if (!otherUid) throw new HttpsError("failed-precondition", "L'autre personne n'a pas encore rejoint l'échange. Le message pourra partir quand elle aura accepté son invitation.");
  const messageId = newId();
  const createdAt = stamp();
  await db.collection("users").doc(uid).collection("threads").doc(input.data.threadId).collection("messages").doc(messageId).set({
    body: input.data.body,
    direction: "out",
    fromLabel: "Vous",
    createdAt,
  });
  await db.collection("users").doc(otherUid).collection("threads").doc(input.data.threadId).collection("messages").doc(messageId).set({
    body: input.data.body,
    direction: "in",
    fromLabel: "Votre correspondant",
    createdAt,
  });
  await db.collection("users").doc(otherUid).collection("threads").doc(input.data.threadId).set(
    { unread: (await unreadPlusOne(otherUid, input.data.threadId)), updatedAt: stamp() },
    { merge: true },
  );
  await db.collection("users").doc(otherUid).collection("notifications").doc(messageId).set({
    title: "Nouveau message",
    body: "Un message vous attend dans votre espace. Son contenu n'est pas repris ici.",
    href: `/participations/${input.data.eventId}/messages`,
    eventId: input.data.eventId,
    read: false,
    kind: "message",
    createdAt: stamp(),
  });
  await db.collection("events").doc(input.data.eventId).update({ "stats.messages": Number(event.data()?.stats?.messages ?? 0) + 1 });
  const recipient = await db.collection("users").doc(otherUid).get();
  const email = String(recipient.data()?.email ?? "");
  if (email) {
    const theme = await loadTheme(input.data.eventId, event.data() ?? {});
    await queueEmail({
      idempotencyKey: `message:${messageId}`,
      to: email,
      uid: otherUid,
      eventId: input.data.eventId,
      templateId: "new_message",
      theme,
      vars: {
        prenom: String(recipient.data()?.displayName ?? "Bonjour"),
        evenement: String(event.data()?.name ?? "Échange"),
        organisateur: "L'organisateur",
        date: "",
        heure: "",
        lien: `${appOrigin()}/participations/${input.data.eventId}/messages`,
        signature: theme.signature || theme.fromName,
      },
    });
  }
  await audit(input.data.eventId, uid, "message.send");
  return { messageId };
});

async function unreadPlusOne(uid: string, threadId: string): Promise<number> {
  const snap = await db.collection("users").doc(uid).collection("threads").doc(threadId).get();
  return Number(snap.data()?.unread ?? 0) + 1;
}

export const reportThread = callable(async (request, uid) => {
  const eventId = String((request.data as { eventId?: string })?.eventId ?? "");
  const threadId = String((request.data as { threadId?: string })?.threadId ?? "");
  const thread = await db.collection("users").doc(uid).collection("threads").doc(threadId).get();
  if (!thread.exists) throw new HttpsError("permission-denied", "Conversation introuvable.");
  await db.collection("events").doc(eventId).collection("serverData").doc(`report_${newId()}`).set({
    threadId,
    reporterUid: uid,
    createdAt: stamp(),
  });
  const event = await db.collection("events").doc(eventId).get();
  const organizerUid = String(event.data()?.organizerUid ?? "");
  if (organizerUid) {
    await db.collection("users").doc(organizerUid).collection("notifications").doc(newId()).set({
      title: "Signalement",
      body: "Un participant a signalé une conversation. Le contenu et les identités ne sont pas inclus.",
      href: `/evenements/${eventId}`,
      eventId,
      read: false,
      kind: "system",
      createdAt: stamp(),
    });
  }
  return { ok: true };
});

export const blockThread = callable(async (request, uid) => {
  const eventId = String((request.data as { eventId?: string })?.eventId ?? "");
  const threadId = String((request.data as { threadId?: string })?.threadId ?? "");
  const thread = await db.collection("users").doc(uid).collection("threads").doc(threadId).get();
  if (!thread.exists) throw new HttpsError("permission-denied", "Conversation introuvable.");
  const ref = db.collection("events").doc(eventId).collection("serverThreads").doc(threadId);
  const snap = await ref.get();
  const blocked = new Set((snap.data()?.blockedBy ?? []) as string[]);
  blocked.add(uid);
  await ref.set({ blockedBy: [...blocked] }, { merge: true });
  return { ok: true };
});

export const saveEmailTheme = callable(async (request, uid) => {
  const input = emailThemeSchema.safeParse(request.data);
  if (!input.success) throw new HttpsError("invalid-argument", input.error.issues[0]?.message ?? "Thème invalide.");
  const { data } = await requireOrganizer(input.data.eventId, uid);
  const commercial = readCommercial(data);
  const rights = emailOfferRights(commercial.offerId, commercial.status);
  const buckets = [process.env.STORAGE_BUCKET || "sous-pli-local.appspot.com"];
  if (input.data.logoUrl && (!rights.logo || !isBrandLogoUrl(input.data.logoUrl, input.data.eventId, buckets, localLinksAllowed()))) {
    throw new HttpsError("permission-denied", "Le logo est réservé à une offre payée qui l'inclut, et seulement pour l'image de marque de cet événement.");
  }
  const subjects = Object.values(input.data.subjectOverrides ?? {}).filter((value) => value.trim());
  if (subjects.length > 0 && !rights.subjects) {
    throw new HttpsError("permission-denied", "Les objets personnalisés sont réservés à une offre payée qui les inclut.");
  }
  const { eventId: _eventId, ...themeFields } = input.data;
  const theme = {
    ...themeFields,
    identity: "event" as const,
    context: data.context,
    occasion: data.occasion,
  };
  try {
    renderEmail(
      { ...theme, subjectOverrides: theme.subjectOverrides ?? {} },
      "invitation",
      PREVIEW_VARS,
      { allowLocalHttp: localLinksAllowed() },
    );
  } catch (error) {
    throw new HttpsError("invalid-argument", error instanceof Error ? error.message : "Le modèle est invalide.");
  }
  await db.collection("events").doc(input.data.eventId).collection("emailTheme").doc("current").set({
    ...theme,
    updatedAt: stamp(),
  });
  await audit(input.data.eventId, uid, "theme.save");
  return { ok: true };
});

export const sendTestEmail = callable(async (request, uid) => {
  const eventId = String((request.data as { eventId?: string })?.eventId ?? "");
  const templateId = String((request.data as { templateId?: string })?.templateId ?? "invitation");
  await assertVerifiedIfEmail(uid);
  const { data } = await requireOrganizer(eventId, uid);
  if (!request.auth?.token.email_verified || !request.auth.token.email) {
    throw new HttpsError("failed-precondition", "Vérifiez votre adresse avant d'envoyer un essai.");
  }
  if (!(EVENT_TEMPLATE_IDS as readonly string[]).includes(templateId)) {
    throw new HttpsError("invalid-argument", "Ce modèle ne s'essaie pas depuis l'événement.");
  }
  await consumeRate(`testmail_${uid}`, 5, 60 * 60 * 1000, "Trop d'essais. Réessayez plus tard.");
  const theme = await loadTheme(eventId, data);
  const status = await queueEmail({
    idempotencyKey: `test:${eventId}:${uid}:${templateId}:${Date.now()}`,
    to: String(request.auth.token.email),
    uid,
    eventId,
    templateId: templateId as (typeof TEMPLATE_IDS)[number],
    theme,
    vars: PREVIEW_VARS,
  });
  return { status };
});
