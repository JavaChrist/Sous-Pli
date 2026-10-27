import { describe, expect, it } from "vitest";
import { defaultTheme, TEMPLATE_IDS } from "@shared/email/templates";
import { PREVIEW_VARS, renderEmail, TemplateError } from "@shared/email/render";
import { canClaim, inspectInvitationState, sha256Hex } from "@shared/invites";
import { mapTabular, sanitizeSpreadsheetCell } from "@shared/import-table";
import { shouldOfferUpdate, shouldOfferInstall, shouldPollVersion, nextInstallVisit, PWA_CHECK_INTERVAL_MS, PWA_LATER_SNOOZE_MS, INSTALL_SNOOZE_MS } from "@shared/pwa";
import { canRevealNow, zonedLocalToUtc } from "@shared/time";

describe("e-mails", () => {
  it("distingue une invitation familiale d'une invitation d'organisation", () => {
    const family = renderEmail(defaultTheme("family", "christmas"), "invitation", PREVIEW_VARS);
    const organization = renderEmail(defaultTheme("organization", "annual"), "invitation", PREVIEW_VARS);
    expect(family.subject).not.toBe(organization.subject);
    expect(family.html).toContain("Échange en famille");
    expect(organization.html).toContain("Échange professionnel");
    const friends = renderEmail(defaultTheme("friends", "other"), "invitation", PREVIEW_VARS);
    expect(friends.html).toContain("Échange entre amis");
    expect(friends.subject).not.toBe(family.subject);
    expect(family.html).not.toContain("{{");
    expect(organization.text).not.toContain("{{");
  });

  it("couvre chaque modèle sans emoji ni variable brute", () => {
    for (const id of TEMPLATE_IDS) {
      for (const theme of [defaultTheme("family", "christmas"), defaultTheme("friends", "other"), defaultTheme("organization", "annual")]) {
        const rendered = renderEmail(theme, id, PREVIEW_VARS);
        expect(rendered.subject).not.toMatch(/\{\{/);
        expect(rendered.html).not.toMatch(/\{\{/);
        expect(rendered.text).not.toMatch(/\p{Extended_Pictographic}/u);
        expect(rendered.html).not.toMatch(/\p{Extended_Pictographic}/u);
        expect(rendered.html).toContain("espace protégé");
      }
    }
  });

  it("neutralise l'injection HTML et les sauts de ligne d'en-tête", () => {
    const rendered = renderEmail(defaultTheme("family", "christmas"), "invitation", {
      ...PREVIEW_VARS,
      prenom: "Awa\r\nBcc: evil@exemple.invalid",
      organisateur: "Alex <script>",
    });
    expect(rendered.subject).not.toMatch(/[\r\n]/);
    expect(rendered.html).not.toContain("<script>");
    expect(rendered.html).toContain("&lt;script&gt;");
  });

  it("refuse une variable inconnue et un lien non HTTPS", () => {
    expect(() =>
      renderEmail(defaultTheme("family", "christmas"), "invitation", { ...PREVIEW_VARS, lien: "http://exemple.invalid/x" }),
    ).toThrow(TemplateError);
    const theme = defaultTheme("family", "christmas");
    theme.subjectOverrides = { invitation: "Bonjour {{destinataire}}" };
    expect(() => renderEmail(theme, "invitation", PREVIEW_VARS)).toThrow(/autorisée/);
  });
});

describe("invitations", () => {
  it("ne consomme pas un jeton à la simple lecture", () => {
    const record = { revoked: false, expiresAt: 5_000, claimedByUid: null };
    expect(inspectInvitationState(record, 1_000)).toBe("valid");
    expect(record.claimedByUid).toBeNull();
    expect(canClaim("valid")).toBe(true);
    expect(inspectInvitationState(record, 9_000)).toBe("expired");
    expect(inspectInvitationState({ ...record, revoked: true }, 1_000)).toBe("revoked");
    expect(inspectInvitationState({ ...record, claimedByUid: "autre" }, 1_000, "moi")).toBe("claimed");
    expect(inspectInvitationState({ ...record, claimedByUid: "moi" }, 1_000, "moi")).toBe("already-yours");
  });

  it("empreinte le secret plutôt que de le stocker en clair", async () => {
    const token = "jeton-secret";
    const hash = await sha256Hex(token);
    expect(hash).not.toBe(token);
    expect(hash).toHaveLength(64);
  });
});

describe("fuseaux", () => {
  it("refuse la révélation avant l'instant prévu, y compris autour de minuit", () => {
    const revealAt = zonedLocalToUtc("2026-12-25", "00:30", "Europe/Paris");
    expect(canRevealNow(new Date("2026-12-24T23:00:00.000Z"), revealAt)).toBe(false);
    expect(canRevealNow(new Date("2026-12-24T23:45:00.000Z"), revealAt)).toBe(true);
  });

  it("tient compte du changement d'heure d'été", () => {
    const before = zonedLocalToUtc("2026-03-29", "01:30", "Europe/Paris");
    const after = zonedLocalToUtc("2026-03-29", "03:30", "Europe/Paris");
    expect(after.getTime() - before.getTime()).toBe(60 * 60 * 1000);
    const autumnEarly = zonedLocalToUtc("2026-10-25", "01:30", "Europe/Paris");
    const autumnLate = zonedLocalToUtc("2026-10-25", "03:30", "Europe/Paris");
    expect(autumnLate.getTime() - autumnEarly.getTime()).toBe(3 * 60 * 60 * 1000);
  });
});

describe("import et mise à jour", () => {
  it("signale un doublon d'adresse et accepte deux prénoms identiques", () => {
    const mapped = mapTabular(
      ["nom", "mail"],
      [
        ["Camille", "a@exemple.fr"],
        ["Camille", "b@exemple.fr"],
        ["Lou", "a@exemple.fr"],
      ],
      { displayName: "nom", email: "mail", group: "" },
    );
    expect(mapped.members.map((member) => member.displayName)).toEqual(["Camille", "Camille"]);
    expect(mapped.warnings).toHaveLength(1);
    expect(mapped.errors).toHaveLength(1);
  });

  it("neutralise une formule de tableur", () => {
    expect(sanitizeSpreadsheetCell("=CMD()")).toBe("'=CMD()");
    expect(sanitizeSpreadsheetCell("Lou")).toBe("Lou");
  });

  it("ouvre la modale quand le commit déployé a changé, et respecte Plus tard", () => {
    const base = {
      now: 10_000,
      snoozeUntil: null,
      pageVersion: "ancien-commit",
      remoteVersion: "nouveau-commit",
      acknowledgedVersion: "ancien-commit",
      checkFailed: false,
      sensitiveLocked: false,
      dialogAlreadyOpen: false,
    };
    expect(shouldOfferUpdate(base)).toBe(true);
    expect(shouldOfferUpdate({ ...base, pageVersion: "dev", remoteVersion: "nouveau-commit" })).toBe(false);
    expect(shouldOfferUpdate({ ...base, remoteVersion: "dev" })).toBe(false);
    expect(shouldOfferUpdate({ ...base, remoteVersion: "ancien-commit" })).toBe(false);
    expect(shouldOfferUpdate({ ...base, checkFailed: true })).toBe(false);
    expect(shouldOfferUpdate({ ...base, remoteVersion: null })).toBe(false);
    expect(shouldOfferUpdate({ ...base, snoozeUntil: base.now + PWA_LATER_SNOOZE_MS })).toBe(false);
    expect(shouldOfferUpdate({ ...base, sensitiveLocked: true })).toBe(false);
    expect(shouldOfferInstall({ now: 10_000, dismissedUntil: null, visits: 3, standalone: false, alreadyShownThisSession: false })).toBe(true);
    expect(shouldOfferInstall({ now: 10_000, dismissedUntil: null, visits: 2, standalone: false, alreadyShownThisSession: false })).toBe(false);
    expect(shouldOfferInstall({ now: 10_000, dismissedUntil: 10_000 + INSTALL_SNOOZE_MS, visits: 8, standalone: false, alreadyShownThisSession: false })).toBe(false);
    expect(shouldOfferInstall({ now: 10_000, dismissedUntil: null, visits: 8, standalone: true, alreadyShownThisSession: false })).toBe(false);
    expect(nextInstallVisit({ visits: 12, lastVisitDay: null, today: "2026-10-27" })).toEqual({ visits: 1, lastVisitDay: "2026-10-27" });
    expect(nextInstallVisit({ visits: 1, lastVisitDay: "2026-10-27", today: "2026-10-27" })).toEqual({ visits: 1, lastVisitDay: "2026-10-27" });
    expect(nextInstallVisit({ visits: 1, lastVisitDay: "2026-10-27", today: "2026-10-28" })).toEqual({ visits: 2, lastVisitDay: "2026-10-28" });
    expect(shouldPollVersion(true, 0, PWA_CHECK_INTERVAL_MS, false)).toBe(true);
    expect(shouldPollVersion(false, 0, PWA_CHECK_INTERVAL_MS * 2, false)).toBe(false);
  });
});
