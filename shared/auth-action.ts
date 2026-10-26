export const PASSWORD_RESET_NOTICE =
  "Si un compte utilisant un mot de passe correspond à cette adresse, tu recevras un lien de réinitialisation.";

export type ActionMode = "resetPassword" | "verifyEmail" | "verifyAndChangeEmail";

export function passwordProviderPresent(providerIds: string[]): boolean {
  return providerIds.includes("password");
}

/** Reprend le code officiel Firebase et le place sur l'origine de l'application. */
export function officialActionUrl(oobLink: string, origin: string, mode: ActionMode): string {
  const source = new URL(oobLink);
  const code = source.searchParams.get("oobCode") ?? "";
  if (source.searchParams.get("mode") !== mode) throw new Error("Mode d'action inattendu.");
  if (!/^[A-Za-z0-9_-]{10,512}$/.test(code)) throw new Error("Code d'action incomplet.");
  const base = new URL(origin);
  const target = new URL("/compte/action", base.origin);
  target.searchParams.set("mode", mode);
  target.searchParams.set("oobCode", code);
  return target.toString();
}
