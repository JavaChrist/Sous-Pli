import { initializeApp, getApps } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { FieldValue, getFirestore, Timestamp, type Firestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { HttpsError, onCall, type CallableRequest } from "firebase-functions/v2/https";
import type { ZodType } from "zod";

if (getApps().length === 0) {
  initializeApp({
    storageBucket: process.env.STORAGE_BUCKET || "sous-pli-local.appspot.com",
  });
}

export const db: Firestore = getFirestore();
export const adminAuth = getAuth();
export const bucket = getStorage().bucket();
export const stamp = () => FieldValue.serverTimestamp();
export const tsNow = () => Timestamp.now();

const enforceAppCheck = process.env.ENFORCE_APP_CHECK === "true";

export function callable<T>(
  handler: (request: CallableRequest<T>, uid: string) => Promise<unknown>,
  options?: { auth?: boolean; timeoutSeconds?: number; memory?: "256MiB" | "512MiB" },
) {
  return onCall(
    {
      region: "europe-west1",
      enforceAppCheck,
      cors: true,
      timeoutSeconds: options?.timeoutSeconds ?? 60,
      memory: options?.memory ?? "256MiB",
      maxInstances: 10,
    },
    async (request) => {
      const uid = request.auth?.uid ?? "";
      if (options?.auth !== false && !uid) throw new HttpsError("unauthenticated", "Connexion requise.");
      return handler(request as CallableRequest<T>, uid);
    },
  );
}

export function parse<T>(schema: ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw new HttpsError("invalid-argument", result.error.issues[0]?.message ?? "Les informations envoyées sont incomplètes.");
  }
  return result.data;
}

export function appOrigin(): string {
  const configured = process.env.APP_PUBLIC_URL?.replace(/\/$/, "");
  if (configured) return configured;
  if (process.env.FUNCTIONS_EMULATOR === "true") return "http://127.0.0.1:3000";
  throw new HttpsError("failed-precondition", "L'adresse publique de l'application n'est pas configurée.");
}

export function localLinksAllowed(): boolean {
  return process.env.FUNCTIONS_EMULATOR === "true";
}

export async function assertVerifiedIfEmail(uid: string): Promise<void> {
  const user = await adminAuth.getUser(uid);
  if (user.email && !user.emailVerified) {
    throw new HttpsError(
      "failed-precondition",
      "Vérifie ton adresse e-mail avant cette action. Tu peux renvoyer le message depuis le profil, consulter l'aide et te déconnecter.",
    );
  }
}

export async function userName(uid: string): Promise<string> {
  const snap = await db.collection("users").doc(uid).get();
  const stored = snap.data()?.displayName;
  if (typeof stored === "string" && stored.trim()) return stored.trim();
  try {
    const user = await adminAuth.getUser(uid);
    return user.displayName || "Organisateur";
  } catch {
    return "Organisateur";
  }
}

export async function consumeRate(key: string, max: number, windowMs: number, message: string) {
  const ref = db.collection("rateLimits").doc(key);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const now = Date.now();
    const data = snap.data() as { windowStart?: number; count?: number } | undefined;
    if (!data || now - Number(data.windowStart ?? 0) > windowMs) {
      tx.set(ref, { windowStart: now, count: 1 });
      return;
    }
    if (Number(data.count ?? 0) >= max) throw new HttpsError("resource-exhausted", message);
    tx.update(ref, { count: Number(data.count ?? 0) + 1 });
  });
}

export function newId(): string {
  return crypto.randomUUID();
}
