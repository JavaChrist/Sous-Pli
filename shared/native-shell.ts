export type ShellPlatform = "web" | "android";
export type GoogleSignInPlan = "popup" | "credential-sign-in" | "credential-link" | "credential-reauth";
export type CheckoutLaunch = "mollie" | "play" | "record-only";

export const AUTH_PERSISTENCE = "local" as const;
export const APP_ORIGIN = "https://souspli.fr";
export const APP_HOST = "souspli.fr";

export const PLAY_PRODUCTS_UNAVAILABLE =
  "Les produits Google Play sont indisponibles. Aucun paiement n'est lancé. Mollie reste disponible sur le site, pas dans l'application.";

export function googleSignInPlan(input: {
  platform: ShellPlatform;
  anonymous: boolean;
  purpose: "sign-in" | "reauth";
}): GoogleSignInPlan {
  if (input.platform !== "android") return "popup";
  if (input.purpose === "reauth") return "credential-reauth";
  if (input.anonymous) return "credential-link";
  return "credential-sign-in";
}

export function keepsAnonymousSession(code: string): boolean {
  return code === "auth/credential-already-in-use" || code === "auth/account-exists-with-different-credential";
}

export function checkoutLaunch(platform: ShellPlatform, kind: "included" | "purchase" | "upgrade" | "settled" | "quote" | "blocked"): CheckoutLaunch {
  if (kind === "purchase" || kind === "upgrade") {
    return platform === "android" ? "play" : "mollie";
  }
  return "record-only";
}

export function linkDisposition(href: string, trustedHost = APP_HOST): "internal" | "system" {
  let url: URL;
  try {
    url = new URL(href, `https://${trustedHost}`);
  } catch {
    return "system";
  }
  if (url.protocol === "mailto:" || url.protocol === "tel:") return "system";
  if (url.protocol === "https:" && url.hostname === trustedHost) return "internal";
  if (url.protocol === "http:" && (trustedHost === "10.0.2.2" || trustedHost === "localhost") && url.hostname === trustedHost) return "internal";
  return "system";
}

export function androidBackAction(canGoBack: boolean, pathname = "/", historyLength = 1): "history" | "exit" {
  if (pathname === "/") return "exit";
  if (canGoBack || historyLength > 1) return "history";
  return "exit";
}

export function isPreparedEntryPath(pathname: string): boolean {
  const invitation = pathname.startsWith("/invitation/") && pathname.length > "/invitation/".length;
  const join = pathname.startsWith("/rejoindre/") && pathname.length > "/rejoindre/".length;
  const accountAction = pathname === "/compte/action" || pathname.startsWith("/compte/action/");
  return invitation || join || accountAction;
}

export function accountExportTransport(platform: ShellPlatform): "browser-download" | "system-document" {
  return platform === "android" ? "system-document" : "browser-download";
}
