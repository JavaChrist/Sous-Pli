import { describe, expect, test } from "vitest";
import {
  PLAY_PRODUCTS_UNAVAILABLE,
  AUTH_PERSISTENCE,
  accountExportTransport,
  androidBackAction,
  checkoutLaunch,
  googleSignInPlan,
  isPreparedEntryPath,
  keepsAnonymousSession,
  linkDisposition,
} from "../shared/native-shell";

describe("coque Android", () => {
  test("Google reste en popup sur le web et passe par un jeton natif sur Android", () => {
    expect(googleSignInPlan({ platform: "web", anonymous: false, purpose: "sign-in" })).toBe("popup");
    expect(googleSignInPlan({ platform: "web", anonymous: true, purpose: "sign-in" })).toBe("popup");
    expect(googleSignInPlan({ platform: "android", anonymous: false, purpose: "sign-in" })).toBe("credential-sign-in");
    expect(googleSignInPlan({ platform: "android", anonymous: true, purpose: "sign-in" })).toBe("credential-link");
    expect(googleSignInPlan({ platform: "android", anonymous: false, purpose: "reauth" })).toBe("credential-reauth");
  });

  test("un conflit de compte Google ne remplace pas la session anonyme", () => {
    expect(keepsAnonymousSession("auth/credential-already-in-use")).toBe(true);
    expect(keepsAnonymousSession("auth/account-exists-with-different-credential")).toBe(true);
    expect(keepsAnonymousSession("auth/invalid-credential")).toBe(false);
  });

  test("la session Firebase locale survit à la fermeture", () => {
    expect(AUTH_PERSISTENCE).toBe("local");
  });

  test("Android ouvre Play et le web conserve Mollie", () => {
    expect(checkoutLaunch("android", "purchase")).toBe("play");
    expect(checkoutLaunch("android", "upgrade")).toBe("play");
    expect(checkoutLaunch("web", "purchase")).toBe("mollie");
    expect(checkoutLaunch("web", "upgrade")).toBe("mollie");
    expect(checkoutLaunch("android", "settled")).toBe("record-only");
    expect(checkoutLaunch("android", "included")).toBe("record-only");
    expect(checkoutLaunch("android", "quote")).toBe("record-only");
    expect(PLAY_PRODUCTS_UNAVAILABLE).toMatch(/indisponibles/);
    expect(PLAY_PRODUCTS_UNAVAILABLE).toMatch(/Mollie/);
  });

  test("le retour sort à la racine et les liens tiers quittent l'application", () => {
    expect(androidBackAction(true, "/profil")).toBe("history");
    expect(androidBackAction(true, "/")).toBe("exit");
    expect(androidBackAction(false, "/profil")).toBe("exit");
    expect(androidBackAction(false, "/profil", 3)).toBe("history");
    expect(androidBackAction(false, "/", 3)).toBe("exit");
    expect(linkDisposition("https://souspli.fr/invitation/jeton")).toBe("internal");
    expect(linkDisposition("https://souspli.fr/tarifs", "sous-pli-preview.vercel.app")).toBe("system");
    expect(linkDisposition("https://sous-pli-preview.vercel.app/tarifs", "sous-pli-preview.vercel.app")).toBe("internal");
    expect(linkDisposition("http://10.0.2.2:3000/profil", "10.0.2.2")).toBe("internal");
    expect(linkDisposition("mailto:support@souspli.fr")).toBe("system");
    expect(linkDisposition("https://www.mollie.com/checkout/select-method/tr_test")).toBe("system");
    expect(isPreparedEntryPath("/invitation/jeton")).toBe(true);
    expect(isPreparedEntryPath("/rejoindre/code")).toBe(true);
    expect(isPreparedEntryPath("/compte/action")).toBe(true);
    expect(isPreparedEntryPath("/tarifs")).toBe(false);
    expect(accountExportTransport("android")).toBe("system-document");
    expect(accountExportTransport("web")).toBe("browser-download");
  });
});
