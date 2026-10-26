import { httpsCallable } from "firebase/functions";
import { getFns } from "./client";

export async function call<T>(name: string, data?: unknown): Promise<T> {
  const fn = httpsCallable<unknown, T>(getFns(), name);
  const result = await fn(data ?? {});
  return result.data;
}

function authMessage(code: string): string | null {
  if (code === "auth/configuration-not-found" || code === "auth/operation-not-allowed") {
    return "La connexion par e-mail n'est pas activée sur ce projet Firebase. Dans la console, ouvre Authentication, active le fournisseur E-mail/Mot de passe, puis ajoute le domaine du site aux domaines autorisés.";
  }
  if (code === "auth/unauthorized-domain") return "Ce domaine n'est pas autorisé dans Firebase Authentication.";
  if (code === "auth/invalid-credential" || code === "auth/wrong-password" || code === "auth/user-not-found" || code === "auth/invalid-login-credentials") {
    return "E-mail ou mot de passe incorrect.";
  }
  if (code === "auth/email-already-in-use") return "Un compte existe déjà avec cette adresse.";
  if (code === "auth/weak-password") return "Le mot de passe est trop faible.";
  if (code === "auth/too-many-requests") return "Trop de tentatives. Réessaie dans un instant.";
  if (code === "auth/network-request-failed") return "Le service d'authentification est injoignable.";
  return null;
}

export function errorText(error: unknown): string {
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return "Vous êtes hors connexion. Rien n'a été enregistré.";
  }
  if (error && typeof error === "object" && "code" in error) {
    const known = authMessage(String((error as { code?: string }).code ?? ""));
    if (known) return known;
  }
  if (error && typeof error === "object" && "message" in error) {
    const message = String((error as { message: string }).message);
    const cleaned = message.replace(/^Firebase:\s*/i, "").replace(/^FirebaseError:\s*/i, "").replace(/\s*\[\d{3}\]$/, "");
    if (cleaned && cleaned !== "internal" && !/^[a-z-]+ \[0\]$/.test(cleaned)) return cleaned;
  }
  return "L'opération n'a pas abouti. Réessayez dans un instant.";
}
