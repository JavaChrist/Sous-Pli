import { httpsCallable } from "firebase/functions";
import { getFns } from "./client";

export async function call<T>(name: string, data?: unknown): Promise<T> {
  const fn = httpsCallable<unknown, T>(getFns(), name);
  const result = await fn(data ?? {});
  return result.data;
}

export function errorText(error: unknown): string {
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return "Vous êtes hors connexion. Rien n'a été enregistré.";
  }
  if (error && typeof error === "object" && "message" in error) {
    const message = String((error as { message: string }).message);
    const cleaned = message.replace(/^Firebase:\s*/i, "").replace(/^FirebaseError:\s*/i, "");
    if (cleaned && cleaned !== "internal" && !/^[a-z-]+ \[0\]$/.test(cleaned)) return cleaned;
  }
  return "L'opération n'a pas abouti. Réessayez dans un instant.";
}
