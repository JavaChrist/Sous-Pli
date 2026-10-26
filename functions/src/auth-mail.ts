import { HttpsError } from "firebase-functions/v2/https";
import { officialActionUrl, passwordProviderPresent, PASSWORD_RESET_NOTICE } from "../../shared/auth-action";
import { serviceTheme } from "../../shared/email/templates";
import { sha256Hex } from "../../shared/invites";
import { adminAuth, appOrigin, callable, consumeRate } from "./admin";
import { queueEmail } from "./mail";

const RESET_NOTICE = PASSWORD_RESET_NOTICE;

function neutralVars(prenom: string, lien: string) {
  return {
    prenom,
    evenement: "Sous pli",
    organisateur: "Sous pli",
    date: "non précisée",
    heure: "non précisée",
    lien,
    signature: "Sous pli",
  };
}

async function rateAddress(prefix: string, email: string, ip: string) {
  const address = await sha256Hex(email.toLowerCase());
  await consumeRate(`${prefix}_addr_${address.slice(0, 32)}`, 5, 60 * 60 * 1000, "Trop de demandes. Réessayez plus tard.");
  if (ip) {
    const origin = await sha256Hex(ip);
    await consumeRate(`${prefix}_ip_${origin.slice(0, 32)}`, 20, 60 * 60 * 1000, "Trop de demandes. Réessayez plus tard.");
  }
}

function clientIp(request: { rawRequest?: { ip?: string; headers?: Record<string, unknown> } }): string {
  const header = request.rawRequest?.headers?.["x-forwarded-for"];
  const forwarded = Array.isArray(header) ? header[0] : header;
  return String(request.rawRequest?.ip || forwarded || "").split(",")[0]?.trim().slice(0, 80) ?? "";
}

export const requestPasswordReset = callable(async (request) => {
  const email = String((request.data as { email?: string })?.email ?? "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 160) {
    throw new HttpsError("invalid-argument", "Adresse invalide.");
  }
  await rateAddress("reset", email, clientIp(request));
  try {
    const user = await adminAuth.getUserByEmail(email);
    const providers = user.providerData.map((item) => item.providerId);
    if (passwordProviderPresent(providers)) {
      const link = await adminAuth.generatePasswordResetLink(email, actionSettings());
      await queueEmail({
        idempotencyKey: `reset:${user.uid}:${Math.floor(Date.now() / (10 * 60 * 1000))}`,
        to: email,
        uid: user.uid,
        eventId: "",
        templateId: "password_reset",
        theme: serviceTheme(),
        vars: neutralVars(user.displayName || "Bonjour", officialActionUrl(link, appOrigin(), "resetPassword")),
      });
    }
  } catch (error) {
    const code = error instanceof Error && "code" in error ? String((error as { code?: string }).code) : "";
    if (code !== "auth/user-not-found") console.error("Réinitialisation non préparée", code || (error instanceof Error ? error.name : "erreur"));
  }
  return { status: "accepted", message: RESET_NOTICE };
}, { auth: false });

export const requestEmailVerification = callable(async (request, uid) => {
  const user = await adminAuth.getUser(uid);
  if (!user.email) throw new HttpsError("failed-precondition", "Ce compte n'a pas d'adresse à vérifier.");
  if (user.emailVerified) return { status: "already" };
  await consumeRate(`verify_${uid}`, 3, 60 * 60 * 1000, "Attends avant de renvoyer l'e-mail de vérification.");
  const link = await adminAuth.generateEmailVerificationLink(user.email, actionSettings());
  const status = await queueEmail({
    idempotencyKey: `verify:${uid}:${Math.floor(Date.now() / (10 * 60 * 1000))}`,
    to: user.email,
    uid,
    eventId: "",
    templateId: "email_verification",
    theme: serviceTheme(),
    vars: neutralVars(user.displayName || "Bonjour", officialActionUrl(link, appOrigin(), "verifyEmail")),
  });
  return { status };
});

export const requestEmailChange = callable(async (request, uid) => {
  const next = String((request.data as { email?: string })?.email ?? "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(next) || next.length > 160) {
    throw new HttpsError("invalid-argument", "Adresse invalide.");
  }
  const authTime = Number(request.auth?.token.auth_time ?? 0);
  if (!authTime || Date.now() / 1000 - authTime > 5 * 60) {
    throw new HttpsError("failed-precondition", "Confirme à nouveau ton identité, puis recommence.");
  }
  const user = await adminAuth.getUser(uid);
  if (!user.email) throw new HttpsError("failed-precondition", "Ce compte n'a pas d'adresse actuelle.");
  if (user.email.toLowerCase() === next) throw new HttpsError("invalid-argument", "Cette adresse est déjà celle du compte.");
  await consumeRate(`change_${uid}`, 3, 60 * 60 * 1000, "Trop de demandes de changement. Réessayez plus tard.");
  let link = "";
  try {
    link = await adminAuth.generateVerifyAndChangeEmailLink(user.email, next, actionSettings());
  } catch (error) {
    const code = error instanceof Error && "code" in error ? String((error as { code?: string }).code) : "";
    if (code === "auth/email-already-exists") throw new HttpsError("already-exists", "Cette adresse est déjà utilisée.");
    if (code === "auth/invalid-email") throw new HttpsError("invalid-argument", "Adresse invalide.");
    console.error("Changement d'adresse non préparé", code || "erreur");
    throw new HttpsError("internal", "Le lien de confirmation n'a pas pu être préparé.");
  }
  const status = await queueEmail({
    idempotencyKey: `change:${uid}:${await sha256Hex(next)}:${Math.floor(Date.now() / (10 * 60 * 1000))}`,
    to: next,
    uid,
    eventId: "",
    templateId: "email_change",
    theme: serviceTheme(),
    vars: neutralVars(user.displayName || "Bonjour", officialActionUrl(link, appOrigin(), "verifyAndChangeEmail")),
  });
  await queueEmail({
    idempotencyKey: `change-notice:${uid}:${Math.floor(Date.now() / (10 * 60 * 1000))}`,
    to: user.email,
    uid,
    eventId: "",
    templateId: "email_change_notice",
    theme: serviceTheme(),
    vars: neutralVars(user.displayName || "Bonjour", `${appOrigin()}/profil`),
  });
  return { status };
});

function actionSettings() {
  return { url: `${appOrigin()}/profil`, handleCodeInApp: false };
}

export async function queueDeletionNotice(uid: string, email: string, prenom: string): Promise<void> {
  if (!email) return;
  await queueEmail({
    idempotencyKey: `deleted:${uid}`,
    to: email,
    uid,
    eventId: "",
    templateId: "account_deleted",
    theme: serviceTheme(),
    scrubRecipient: true,
    vars: neutralVars(prenom || "Bonjour", `${appOrigin()}/`),
  });
}

