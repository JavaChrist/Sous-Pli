import { describe, expect, it } from "vitest";
import { PASSWORD_RESET_NOTICE, officialActionUrl, passwordProviderPresent } from "@shared/auth-action";
import { emailOfferRights } from "@shared/billing";
import { isBrandLogoUrl } from "@shared/email/brand";
import { PREVIEW_VARS, renderEmail } from "@shared/email/render";
import { defaultTheme, serviceTheme } from "@shared/email/templates";
import { canRemindView, canRemindWishes } from "@shared/reminders";

describe("e-mails de compte et d'offre", () => {
  it("affiche une identité neutre pour les messages de service", () => {
    const rendered = renderEmail(serviceTheme(), "password_reset", PREVIEW_VARS);
    expect(rendered.html).toContain("Sous pli");
    expect(rendered.html).not.toContain("Échange en famille");
    expect(rendered.html).not.toContain("#F4EFE6");
    expect(rendered.subject).not.toMatch(/\{\{/);
  });

  it("réserve le logo et les objets aux offres payées qui les incluent", () => {
    expect(emailOfferRights("family", "included")).toEqual({ logo: false, subjects: false });
    expect(emailOfferRights("association", "unpaid")).toEqual({ logo: false, subjects: false });
    expect(emailOfferRights("association", "paid")).toEqual({ logo: true, subjects: true });
    expect(emailOfferRights("business_plus", "paid")).toEqual({ logo: true, subjects: true });
    expect(emailOfferRights("quote", "unpaid")).toEqual({ logo: false, subjects: false });
  });

  it("n'accepte comme logo qu'une image de marque de l'événement", () => {
    const eventId = "evt-1";
    const buckets = ["sous-pli-local.appspot.com"];
    const brand = "https://firebasestorage.googleapis.com/v0/b/sous-pli-local.appspot.com/o/events%2Fevt-1%2Fbrand%2Flogo?alt=media";
    const wish = "https://firebasestorage.googleapis.com/v0/b/sous-pli-local.appspot.com/o/events%2Fevt-1%2Fwishes%2Fmembre%2Fphoto?alt=media";
    const other = "https://exemple.invalid/logo.png";
    expect(isBrandLogoUrl(brand, eventId, buckets, false)).toBe(true);
    expect(isBrandLogoUrl(wish, eventId, buckets, false)).toBe(false);
    expect(isBrandLogoUrl(other, eventId, buckets, false)).toBe(false);
    expect(isBrandLogoUrl("http://127.0.0.1:9199/v0/b/sous-pli-local.appspot.com/o/events%2Fevt-1%2Fbrand%2Flogo", eventId, buckets, true)).toBe(true);
    expect(isBrandLogoUrl("http://127.0.0.1:9199/v0/b/sous-pli-local.appspot.com/o/events%2Fevt-1%2Fbrand%2Flogo", eventId, buckets, false)).toBe(false);
  });

  it("reprend le code Firebase sans conserver la clé d'API dans le lien affiché", () => {
    const source = "https://sous-pli-local.firebaseapp.com/__/auth/action?mode=resetPassword&oobCode=abc1234567890XYZ&apiKey=secret-key&lang=fr";
    const link = officialActionUrl(source, "http://127.0.0.1:3000", "resetPassword");
    expect(link.startsWith("http://127.0.0.1:3000/compte/action?")).toBe(true);
    expect(link).toContain("oobCode=abc1234567890XYZ");
    expect(link).not.toContain("apiKey");
    expect(link).not.toContain("secret-key");
    expect(() => officialActionUrl(source, "http://127.0.0.1:3000", "verifyEmail")).toThrow(/Mode/);
  });

  it("ne révèle pas l'existence d'un compte dans la réponse de réinitialisation", () => {
    expect(PASSWORD_RESET_NOTICE).toBe("Si un compte utilisant un mot de passe correspond à cette adresse, tu recevras un lien de réinitialisation.");
    expect(passwordProviderPresent(["google.com"])).toBe(false);
    expect(passwordProviderPresent(["password"])).toBe(true);
  });

  it("ne relance que les participants encore éligibles", () => {
    const now = Date.parse("2026-10-22T12:00:00Z");
    const future = Date.parse("2026-12-24T18:00:00Z");
    expect(canRemindView({ status: "drawn", discovered: false, declined: false, startsAt: future, now })).toBe(true);
    expect(canRemindView({ status: "drawn", discovered: true, declined: false, startsAt: future, now })).toBe(false);
    expect(canRemindView({ status: "cancelled", discovered: false, declined: false, startsAt: future, now })).toBe(false);
    expect(canRemindView({ status: "drawn", discovered: false, declined: false, startsAt: now, now })).toBe(false);
    expect(canRemindWishes({ status: "ready", filled: false, declined: false, startsAt: future, now })).toBe(true);
    expect(canRemindWishes({ status: "ready", filled: true, declined: false, startsAt: future, now })).toBe(false);
    expect(canRemindWishes({ status: "drawn", filled: false, declined: false, startsAt: future, now })).toBe(false);
  });

  it("garde le contexte réel dans le rendu d'invitation", () => {
    const theme = { ...defaultTheme("organization", "annual"), tone: "vous" as const, palette: "sobre" as const, intro: "Bienvenue dans l'équipe." };
    const rendered = renderEmail(theme, "invitation", PREVIEW_VARS);
    expect(rendered.html).toContain("Échange professionnel");
    expect(rendered.html).toContain("Bienvenue dans l&#39;équipe.");
    expect(rendered.html).not.toContain("Échange en famille");
  });
});
