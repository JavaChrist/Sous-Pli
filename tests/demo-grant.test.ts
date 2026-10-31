import { describe, expect, test } from "vitest";
import { amountDue, hasPaidBusinessPlus, readCommercial } from "../shared/billing";
import {
  PLAY_REVIEW_GRANT_MS,
  businessPlusFeatures,
  commercialOrderRefusal,
  drawAllowed,
  mailFeatureRights,
  planPlayReviewEvents,
  playReviewAllows,
  playReviewFeatures,
} from "../shared/demo";

const beneficiary = "playreviewer0000000000000001";
const stranger = "autrecompte000000000000000001";
const now = Date.parse("2026-10-31T00:00:00.000Z");

function strings(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(strings);
  if (value && typeof value === "object") return Object.values(value).flatMap(strings);
  return [];
}

function planned() {
  const plan = planPlayReviewEvents(beneficiary, now);
  if (!plan.ok) throw new Error(plan.reason);
  return plan.events;
}

describe("droit d'examen Google Play", () => {
  test("prépare deux événements Entreprise Plus sans commande, sans adresse et sans envoi", () => {
    const [organisation, drawn] = planned();
    expect(organisation.name).toBe("Noël de démonstration — Organisation");
    expect(drawn.name).toBe("Noël de démonstration — Tirage effectué");
    expect(organisation.status).toBe("ready");
    expect(drawn.status).toBe("drawn");
    expect(organisation.offerId).toBe("business_plus");
    expect(organisation.commercialStatus).toBe("unpaid");
    expect(organisation.paidOfferId).toBeNull();
    expect(organisation.paidAmountCents).toBe(0);
    expect(organisation.payments).toEqual([]);
    expect(organisation.outboundEmails).toEqual([]);
    expect(drawn.payments).toEqual([]);
    expect(drawn.outboundEmails).toEqual([]);
    expect(strings(planned()).some((value) => value.includes("@"))).toBe(false);
    expect(organisation.members.map((member) => member.email)).toEqual(["", "", "", ""]);
    expect(organisation.coOrganizers.map((row) => row.displayName)).toEqual(["Camille (fictif)", "Marc (fictif)"]);
    expect(drawn.coOrganizers).toEqual([]);
    expect(organisation.wishes.length).toBeGreaterThan(0);
    expect(organisation.teams.every((team) => team.discovered === 0)).toBe(true);
    expect(drawn.assignments.length).toBe(organisation.members.length);
    expect(drawn.messages).toEqual([{
      id: "demo-message-1",
      body: "Le paquet fictif est prêt. Ce message ne part vers personne.",
      fromLabel: "Votre correspondant",
      direction: "in",
    }]);
    expect(organisation.demoGrant.expiresAtMs - now).toBe(PLAY_REVIEW_GRANT_MS);
  });

  test("refuse de préparer un droit sans compte examinateur", () => {
    expect(planPlayReviewEvents("", now).ok).toBe(false);
    expect(planPlayReviewEvents("compte incomplet", now).ok).toBe(false);
  });

  test("ouvre les fonctions au bénéficiaire et les refuse à un autre compte", () => {
    const [organisation, drawn] = planned();
    const record = { ...organisation, organizerUid: beneficiary };
    const drawnRecord = { ...drawn, organizerUid: beneficiary };
    expect(playReviewAllows(record, beneficiary, now)).toBe(true);
    expect(playReviewAllows(record, stranger, now)).toBe(false);
    expect(playReviewAllows(record, "", now)).toBe(false);
    expect(businessPlusFeatures(record, beneficiary, now)).toBe(true);
    expect(businessPlusFeatures(record, stranger, now)).toBe(false);
    expect(mailFeatureRights(record, beneficiary, now)).toEqual({ logo: true, subjects: true });
    expect(mailFeatureRights(record, stranger, now)).toEqual({ logo: false, subjects: false });
    expect(drawAllowed(record, beneficiary, now)).toBeNull();
    expect(drawAllowed(record, stranger, now)).toMatch(/paiement/);
    expect(playReviewFeatures(drawnRecord, now).teamProgress).toBe(true);
    expect(hasPaidBusinessPlus(record)).toBe(false);
  });

  test("retire le droit à l'échéance et à la révocation", () => {
    const [organisation] = planned();
    const record = { ...organisation, organizerUid: beneficiary };
    const expired = { ...record, demoGrant: { ...record.demoGrant, expiresAtMs: now } };
    const revoked = { ...record, demoGrant: { ...record.demoGrant, revokedAtMs: now } };
    expect(playReviewAllows(expired, beneficiary, now)).toBe(false);
    expect(playReviewAllows(revoked, beneficiary, now)).toBe(false);
    expect(drawAllowed(expired, beneficiary, now)).toMatch(/paiement/);
    expect(playReviewFeatures(revoked, now)).toEqual({ teamProgress: false, mail: false });
    expect(commercialOrderRefusal(expired, now)).toBeNull();
    expect(commercialOrderRefusal(record, now)).toMatch(/démonstration/);
  });

  test("ne change pas une offre ordinaire ni une commande remboursée", () => {
    const refunded = {
      name: "Échange associatif",
      offerId: "association" as const,
      commercialStatus: "refunded" as const,
      paidOfferId: null,
      paidAmountCents: 0,
      organizerUid: beneficiary,
    };
    const unpaid = {
      name: "Noël de démonstration — Organisation",
      offerId: "business_plus" as const,
      commercialStatus: "unpaid" as const,
      paidOfferId: null,
      organizerUid: beneficiary,
    };
    expect(drawAllowed(refunded, beneficiary, now)).toMatch(/paiement/);
    expect(businessPlusFeatures(refunded, beneficiary, now)).toBe(false);
    expect(commercialOrderRefusal(refunded, now)).toBeNull();
    expect(commercialOrderRefusal(unpaid, now)).toBeNull();
    expect(amountDue({ offerId: "business_plus", paidOfferId: null, eventStatus: "ready" }).kind).toBe("purchase");
    expect(amountDue({ offerId: "business_plus", paidOfferId: null, eventStatus: "ready" }).cents).toBe(3990);
    expect(readCommercial(refunded).status).toBe("refunded");
    const paid = { offerId: "business_plus" as const, commercialStatus: "paid" as const, paidOfferId: "business_plus" as const };
    expect(drawAllowed(paid, stranger, now)).toBeNull();
    expect(hasPaidBusinessPlus(paid)).toBe(true);
  });
});
