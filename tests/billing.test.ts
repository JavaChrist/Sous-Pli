import { describe, expect, test } from "vitest";
import {
  UPGRADE_BUSINESS_TO_PLUS_CENTS,
  amountDue,
  asksPayment,
  billingPolicy,
  canSubmitRefund,
  centsToMollieValue,
  formatEuros,
  launchBlock,
  mollieValueToCents,
  offersForContext,
  participantCount,
  readCommercial,
  readMolliePayment,
  rosterDecision,
  settlementMatches,
  withdrawalOpen,
} from "../shared/billing";

describe("catalogue", () => {
  test("seule une offre à prix fixe ouvre le paiement à la création", () => {
    expect(asksPayment("family")).toBe(false);
    expect(asksPayment("quote")).toBe(false);
    expect(asksPayment("association")).toBe(true);
    expect(asksPayment("business")).toBe(true);
    expect(asksPayment("business_plus")).toBe(true);
  });

  test("les prix affichés sont les montants finaux en euros", () => {
    const money = (cents: number) => formatEuros(cents).replace(/\s/g, " ");
    expect(money(0)).toBe("0,00 €");
    expect(money(990)).toBe("9,90 €");
    expect(money(1990)).toBe("19,90 €");
    expect(money(3990)).toBe("39,90 €");
  });

  test("le contexte déclaré filtre les offres sans prétendre le vérifier", () => {
    expect(offersForContext("family").map((offer) => offer.id)).toEqual(["family"]);
    expect(offersForContext("friends").map((offer) => offer.id)).toEqual(["family"]);
    expect(offersForContext("organization").map((offer) => offer.id)).toEqual(["association", "business", "business_plus", "quote"]);
  });

  test("la montée Entreprise vers Entreprise Plus coûte 20 euros avant le tirage", () => {
    const due = amountDue({ offerId: "business_plus", paidOfferId: "business", eventStatus: "draft" });
    expect(due.kind).toBe("upgrade");
    expect(due.cents).toBe(UPGRADE_BUSINESS_TO_PLUS_CENTS);
    expect(due.cents).toBe(2_000);
  });

  test("un montant client ne remplace pas le catalogue", () => {
    const due = amountDue({ offerId: "business", paidOfferId: null, eventStatus: "draft" });
    expect(due.cents).toBe(1990);
    expect(settlementMatches(due.cents, { amountCents: 1, currency: "eur" })).toBe(false);
    expect(settlementMatches(due.cents, { amountCents: 1990, currency: "eur" })).toBe(true);
  });

  test("le tirage lancé bloque un paiement qui changerait le groupe", () => {
    expect(amountDue({ offerId: "business_plus", paidOfferId: "business", eventStatus: "drawn" }).kind).toBe("blocked");
  });

  test("le retour navigateur ne suffit pas : seul le statut payé débloque", () => {
    expect(launchBlock({ offerId: "business", status: "pending", paidOfferId: null })).toMatch(/Confirmation/);
    expect(launchBlock({ offerId: "business", status: "paid", paidOfferId: "association" })).toBeTruthy();
    expect(launchBlock({ offerId: "business", status: "paid", paidOfferId: "business" })).toBeNull();
    expect(launchBlock({ offerId: "family", status: "included", paidOfferId: null })).toBeNull();
  });

  test("la capacité compte les participants et n'en retire aucun", () => {
    expect(participantCount([{ status: "joined" }, { status: "draft" }, { status: "declined" }])).toBe(2);
    const overflow = rosterDecision(51, "family");
    expect(overflow.ok).toBe(false);
    if (!overflow.ok) expect(overflow.message).toMatch(/Personne n'a été retiré/);
    expect(rosterDecision(50, "family").ok).toBe(true);
    expect(rosterDecision(301, "quote").ok).toBe(false);
  });

  test("un ancien événement sans offre reste lisible", () => {
    expect(readCommercial({ context: "family" }).offerId).toBe("family");
    expect(readCommercial({ context: "organization" }).status).toBe("unpaid");
  });

  test("une URL de retour ne débloque pas tant que Mollie n'a pas confirmé le paiement", () => {
    expect(launchBlock({ offerId: "business", status: "pending", paidOfferId: null })).toMatch(/navigateur|Confirmation/);
    const forged = readMolliePayment({
      id: "tr_testpayment12",
      mode: "test",
      status: "open",
      amount: { value: "19.90", currency: "EUR" },
      metadata: { paymentId: "commande-1" },
    });
    expect(forged.ok && forged.reading.outcome).toBe("pending");
  });

  test("Mollie : montant, test seulement, idempotence d'état et remboursement unique", () => {
    expect(centsToMollieValue(1990)).toBe("19.90");
    expect(mollieValueToCents("19.90")).toBe(1990);
    expect(billingPolicy.taxNote).toMatch(/293 B/);
    expect(billingPolicy.realChargesEnabled).toBe(false);
    const paid = readMolliePayment({
      id: "tr_testpayment12",
      mode: "test",
      status: "paid",
      amount: { value: "19.90", currency: "EUR" },
      amountRefunded: { value: "0.00" },
      metadata: { paymentId: "commande-1" },
    });
    expect(paid.ok && paid.reading.outcome).toBe("succeeded");
    const live = readMolliePayment({ id: "tr_testpayment12", mode: "live", status: "paid", amount: { value: "19.90", currency: "EUR" }, metadata: { paymentId: "commande-1" } });
    expect(live.ok).toBe(false);
    const again = readMolliePayment({
      id: "tr_testpayment12",
      mode: "test",
      status: "paid",
      amount: { value: "19.90", currency: "EUR" },
      metadata: { paymentId: "commande-1" },
    });
    expect(again.ok && `${again.reading.providerRef}:${again.reading.outcome}`).toBe("tr_testpayment12:succeeded");
    const refunded = readMolliePayment({
      id: "tr_testpayment12",
      mode: "test",
      status: "paid",
      amount: { value: "19.90", currency: "EUR" },
      amountRefunded: { value: "19.90" },
      metadata: { paymentId: "commande-1" },
    });
    expect(refunded.ok && refunded.reading.outcome).toBe("refunded");
    expect(canSubmitRefund("requested")).toBe(true);
    expect(canSubmitRefund("submitted")).toBe(false);
    expect(canSubmitRefund("refunded")).toBe(false);
    const start = Date.parse("2026-10-01T10:00:00.000Z");
    expect(withdrawalOpen(start, start + 14 * 24 * 60 * 60 * 1000)).toBe(true);
    expect(withdrawalOpen(start, start + 14 * 24 * 60 * 60 * 1000 + 1)).toBe(false);
  });
});
