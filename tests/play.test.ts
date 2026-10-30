import { describe, expect, test } from "vitest";
import { amountDue } from "../shared/billing";
import {
  PLAY_PACKAGE_NAME,
  PLAY_PRODUCTS,
  assessPlayPurchase,
  commercialCentsForProduct,
  decidePlayIntent,
  entitlementFromLedger,
  isOpaquePlayId,
  nextConsume,
  noticeAlreadySeen,
  playProductForDue,
  playProductIdAllowed,
  playPurchaseAccess,
  playPurchaseAllowed,
  playTestUids,
  pushClaimsOk,
  readDeveloperNotification,
  readProductPurchaseV2,
  readPubSubEnvelope,
  type LedgerLine,
  type PlayOrderView,
  type PlayReading,
} from "../shared/play";

const account = "a".repeat(32);
const otherAccount = "b".repeat(32);

function order(partial: Partial<PlayOrderView> = {}): PlayOrderView {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    organizerUid: "orga",
    eventId: "evenement-1",
    productId: "souspli_business_event",
    obfuscatedAccountId: account,
    status: "open",
    tokenHash: null,
    consumeState: "none",
    launchUntilMs: 1_000,
    ...partial,
  };
}

function reading(partial: Partial<PlayReading> = {}): PlayReading {
  return {
    packageName: PLAY_PACKAGE_NAME,
    productId: "souspli_business_event",
    purchaseState: "purchased",
    consumed: false,
    acknowledged: false,
    obfuscatedAccountId: account,
    obfuscatedProfileId: "11111111-1111-4111-8111-111111111111",
    orderId: "GPA.1",
    testPurchase: true,
    ...partial,
  };
}

function line(partial: Partial<LedgerLine> & Pick<LedgerLine, "id" | "offerId" | "kind">): LedgerLine {
  return { status: "succeeded", createdAtMs: 1, ...partial };
}

describe("ouverture des achats Play", () => {
  test("refuse le public tant que l'accès n'est pas explicitement public", () => {
    expect(playPurchaseAllowed(playPurchaseAccess(undefined), "uid-test", ["uid-test"])).toBe(false);
    expect(playPurchaseAllowed(playPurchaseAccess("off"), "uid-test", ["uid-test"])).toBe(false);
    expect(playPurchaseAllowed(playPurchaseAccess("oui"), "uid-test", ["uid-test"])).toBe(false);
    expect(playPurchaseAllowed(playPurchaseAccess("test"), "uid-test", playTestUids(" uid-autre, uid-test "))).toBe(true);
    expect(playPurchaseAllowed(playPurchaseAccess("test"), "uid-public", playTestUids("uid-test"))).toBe(false);
    expect(playPurchaseAllowed(playPurchaseAccess("test"), "uid-test", playTestUids(""))).toBe(false);
    expect(playPurchaseAllowed(playPurchaseAccess("public"), "uid-public", [])).toBe(true);
  });
});

describe("catalogue Play", () => {
  test("les quatre identifiants respectent les contraintes et couvrent achat et supplément", () => {
    for (const id of Object.keys(PLAY_PRODUCTS)) {
      expect(playProductIdAllowed(id)).toBe(true);
      expect(id.startsWith("android.test")).toBe(false);
      expect(id.length).toBeLessThanOrEqual(40);
    }
    expect(playProductForDue("purchase", "association")).toBe("souspli_association_event");
    expect(playProductForDue("purchase", "business")).toBe("souspli_business_event");
    expect(playProductForDue("purchase", "business_plus")).toBe("souspli_business_plus_event");
    expect(playProductForDue("upgrade", "business_plus")).toBe("souspli_business_plus_upgrade");
    expect(playProductForDue("quote", "quote")).toBeNull();
    expect(Object.keys(PLAY_PRODUCTS).sort()).toEqual([
      "souspli_association_event",
      "souspli_business_event",
      "souspli_business_plus_event",
      "souspli_business_plus_upgrade",
    ]);
    expect(commercialCentsForProduct("souspli_association_event")).toBe(990);
    expect(commercialCentsForProduct("souspli_business_event")).toBe(1990);
    expect(commercialCentsForProduct("souspli_business_plus_event")).toBe(3990);
    expect(commercialCentsForProduct("souspli_business_plus_upgrade")).toBe(2000);
    expect(isOpaquePlayId("contact@example.com")).toBe(false);
    expect(isOpaquePlayId(account)).toBe(true);
  });

  test("le supplément n'existe que si Entreprise est déjà payée", () => {
    const eligible = amountDue({ offerId: "business_plus", paidOfferId: "business", eventStatus: "draft" });
    const refused = amountDue({ offerId: "business_plus", paidOfferId: null, eventStatus: "draft" });
    const afterDraw = amountDue({ offerId: "business_plus", paidOfferId: "business", eventStatus: "drawn" });
    expect(eligible.kind).toBe("upgrade");
    expect(playProductForDue(eligible.kind, "business_plus")).toBe("souspli_business_plus_upgrade");
    expect(refused.kind).toBe("purchase");
    expect(playProductForDue(refused.kind, "business_plus")).toBe("souspli_business_plus_event");
    expect(playProductForDue(afterDraw.kind, "business_plus")).toBeNull();
  });
});

describe("intention et jeton", () => {
  test("une commande ouverte se réutilise, une autre offre l'annule, un paiement en attente bloque", () => {
    const open = { id: "a", productId: "souspli_association_event", status: "open" as const, tokenHash: null, launchUntilMs: 500 };
    expect(decidePlayIntent("souspli_association_event", 100, [open]).action).toBe("reuse");
    const changed = decidePlayIntent("souspli_business_event", 100, [open]);
    expect(changed).toEqual({ action: "replace", cancelIds: ["a"] });
    const pending = { ...open, status: "pending" as const };
    expect(decidePlayIntent("souspli_business_event", 100, [pending]).action).toBe("refuse");
  });

  test("le jeton est refusé s'il appartient déjà à une autre commande", () => {
    const result = assessPlayPurchase({
      order: order(),
      reading: reading(),
      tokenHash: "hash-1",
      tokenOwnerPaymentId: "autre-commande",
      callerUid: "orga",
      nowMs: 5_000,
      ledger: [],
    });
    expect(result.outcome).toBe("reject");
    expect(result.entitlement.paidOfferId).toBeNull();
    expect(result.consume).toBe(false);
  });

  test("l'événement vient de la commande, même si l'intention a expiré", () => {
    const current = order({ launchUntilMs: 10 });
    const result = assessPlayPurchase({
      order: current,
      reading: reading(),
      tokenHash: "hash-1",
      tokenOwnerPaymentId: null,
      callerUid: "orga",
      nowMs: 5_000,
      ledger: [line({ id: current.id, offerId: "business", kind: "purchase", status: "open", createdAtMs: 1 })],
    });
    expect(result.outcome).toBe("grant");
    expect(result.eventId).toBe("evenement-1");
    expect(result.entitlement.paidOfferId).toBe("business");
    expect(result.entitlement.paidAmountCents).toBe(1990);
  });

  test("un compte ou un produit différent n'accorde rien", () => {
    const mismatch = assessPlayPurchase({
      order: order(),
      reading: reading({ obfuscatedAccountId: otherAccount }),
      tokenHash: "hash-1",
      tokenOwnerPaymentId: null,
      callerUid: "orga",
      nowMs: 5_000,
      ledger: [],
    });
    expect(mismatch.outcome).toBe("reject");
    expect(mismatch.consume).toBe(false);
  });
});

describe("états Play", () => {
  test("un achat en attente n'accorde rien, puis la confirmation l'attribue", () => {
    const pending = assessPlayPurchase({
      order: order(),
      reading: reading({ purchaseState: "pending" }),
      tokenHash: "hash-1",
      tokenOwnerPaymentId: null,
      callerUid: "orga",
      nowMs: 20,
      ledger: [],
    });
    expect(pending.outcome).toBe("pending");
    expect(pending.entitlement.commercialStatus).toBe("unpaid");
    const confirmed = assessPlayPurchase({
      order: order({ status: "pending", tokenHash: "hash-1" }),
      reading: reading(),
      tokenHash: "hash-1",
      tokenOwnerPaymentId: order().id,
      callerUid: "orga",
      nowMs: 30,
      ledger: [line({ id: order().id, offerId: "business", kind: "purchase", status: "pending", createdAtMs: 20 })],
    });
    expect(confirmed.outcome).toBe("grant");
    expect(confirmed.entitlement.paidOfferId).toBe("business");
    expect(confirmed.consume).toBe(true);
  });

  test("une seconde notification n'attribue pas une seconde fois et relance la consommation si elle a échoué", () => {
    const granted = order({ status: "succeeded", tokenHash: "hash-1", consumeState: "due" });
    const ledger = [line({ id: granted.id, offerId: "business", kind: "purchase", createdAtMs: 20 })];
    const again = assessPlayPurchase({
      order: granted,
      reading: reading(),
      tokenHash: "hash-1",
      tokenOwnerPaymentId: granted.id,
      callerUid: "orga",
      nowMs: 40,
      ledger,
    });
    expect(noticeAlreadySeen(true)).toBe(true);
    expect(again.outcome).toBe("duplicate");
    expect(again.entitlement.paidAmountCents).toBe(1990);
    expect(nextConsume({ granted: true, consumeState: "due", googleConsumed: false })).toBe("consume");
    expect(nextConsume({ granted: true, consumeState: "due", googleConsumed: true })).toBe("done");
    expect(nextConsume({ granted: false, consumeState: "none", googleConsumed: false })).toBe("hold");
  });
});

describe("remboursements", () => {
  test("le remboursement du supplément ramène à Entreprise", () => {
    const base = line({ id: "base", offerId: "business", kind: "purchase", createdAtMs: 1 });
    const upgrade = line({ id: "plus", offerId: "business_plus", kind: "upgrade", createdAtMs: 2 });
    expect(entitlementFromLedger([base, upgrade]).paidOfferId).toBe("business_plus");
    expect(entitlementFromLedger([base, { ...upgrade, status: "refunded" }])).toMatchObject({
      paidOfferId: "business",
      paidAmountCents: 1990,
      commercialStatus: "paid",
    });
  });

  test("le remboursement de l'achat initial ne conserve pas le supplément", () => {
    const base = line({ id: "base", offerId: "business", kind: "purchase", createdAtMs: 1, status: "refunded" });
    const upgrade = line({ id: "plus", offerId: "business_plus", kind: "upgrade", createdAtMs: 2 });
    expect(entitlementFromLedger([base, upgrade])).toMatchObject({
      commercialStatus: "refunded",
      paidOfferId: null,
      paidAmountCents: 0,
    });
  });

  test("une notification tardive sur une ancienne commande ne retire pas un droit acquis ensuite", () => {
    const oldAssociation = line({ id: "old", offerId: "association", kind: "purchase", createdAtMs: 1, status: "refunded" });
    const laterBusiness = line({ id: "later", offerId: "business", kind: "purchase", createdAtMs: 2 });
    expect(entitlementFromLedger([laterBusiness, oldAssociation]).paidOfferId).toBe("business");
    const late = assessPlayPurchase({
      order: order({ id: "old", productId: "souspli_association_event", status: "succeeded", tokenHash: "hash-old" }),
      reading: reading({
        productId: "souspli_association_event",
        obfuscatedProfileId: "old",
        purchaseState: "canceled",
      }),
      tokenHash: "hash-old",
      tokenOwnerPaymentId: "old",
      callerUid: "orga",
      nowMs: 90,
      ledger: [
        line({ id: "old", offerId: "association", kind: "purchase", createdAtMs: 1 }),
        laterBusiness,
      ],
    });
    expect(late.outcome).toBe("refund");
    expect(late.entitlement.paidOfferId).toBe("business");
    expect(late.eventId).toBe("evenement-1");
  });
});

describe("avis Google", () => {
  test("l'achat v2 et l'avis Pub/Sub sont lus sans accorder un état en attente", () => {
    const parsed = readProductPurchaseV2({
      purchaseStateContext: { purchaseState: "PENDING" },
      acknowledgementState: "ACKNOWLEDGEMENT_STATE_PENDING",
      obfuscatedExternalAccountId: account,
      obfuscatedExternalProfileId: "11111111-1111-4111-8111-111111111111",
      orderId: "GPA.2",
      productLineItem: [{
        productId: "souspli_association_event",
        productOfferDetails: { consumptionState: "CONSUMPTION_STATE_YET_TO_BE_CONSUMED" },
      }],
    }, PLAY_PACKAGE_NAME);
    expect(parsed?.purchaseState).toBe("pending");
    expect(parsed?.consumed).toBe(false);
    const encoded = Buffer.from(JSON.stringify({
      packageName: PLAY_PACKAGE_NAME,
      oneTimeProductNotification: {
        version: "1.0",
        notificationType: 1,
        purchaseToken: "jeton-de-test",
        sku: "souspli_business_event",
      },
    })).toString("base64");
    const envelope = readPubSubEnvelope({ message: { messageId: "message-1", data: encoded } });
    const notice = readDeveloperNotification(envelope?.payload, envelope?.messageId ?? "");
    expect(notice).toMatchObject({ kind: "one-time", productId: "souspli_business_event", refund: false });
    expect(pushClaimsOk({
      aud: "https://exemple.invalid/play",
      email: "push@exemple.invalid",
      email_verified: true,
      iss: "https://accounts.google.com",
      exp: 200,
    }, { audience: "https://exemple.invalid/play", email: "push@exemple.invalid", nowSec: 100 })).toBe(true);
    expect(pushClaimsOk({
      aud: "https://autre.invalid",
      email: "push@exemple.invalid",
      email_verified: true,
      iss: "https://accounts.google.com",
      exp: 200,
    }, { audience: "https://exemple.invalid/play", email: "push@exemple.invalid", nowSec: 100 })).toBe(false);
  });
});
