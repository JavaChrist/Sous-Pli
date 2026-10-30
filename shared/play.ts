import { CATALOG, UPGRADE_BUSINESS_TO_PLUS_CENTS, isOfferId, type OfferId } from "./billing";

/**
 * Achats uniques consommables. Identifiants figés après contrôle Play :
 * début chiffre ou minuscule, puis [a-z0-9_.], hors préfixe android.test.
 * L'API one-time ne publie pas de longueur max ; les abonnements sont limités à 40.
 * Tous restent sous cette limite. Ce ne sont pas des abonnements.
 * Bibliothèque cliente : Play Billing 8.3.0 (minSdk 23, projet à 24).
 */
export const PLAY_BILLING_LIBRARY = "8.3.0";
export const PLAY_PACKAGE_NAME = "fr.javachrist.souspli";
export const PLAY_ACK_WINDOW_MS = 3 * 24 * 60 * 60 * 1000;
export const PLAY_LAUNCH_WINDOW_MS = 30 * 60 * 1000;

export const PLAY_PRODUCTS = {
  souspli_association_event: { offerId: "association" as const, kind: "purchase" as const },
  souspli_business_event: { offerId: "business" as const, kind: "purchase" as const },
  souspli_business_plus_event: { offerId: "business_plus" as const, kind: "purchase" as const },
  souspli_business_plus_upgrade: { offerId: "business_plus" as const, kind: "upgrade" as const },
};

export type PlayProductId = keyof typeof PLAY_PRODUCTS;
export type PlayKind = "purchase" | "upgrade";

const PRODUCT_ID = /^[a-z0-9][a-z0-9_.]{0,39}$/;

export function isPlayProductId(value: string): value is PlayProductId {
  return Object.prototype.hasOwnProperty.call(PLAY_PRODUCTS, value);
}

export function playProductIdAllowed(value: string): boolean {
  return PRODUCT_ID.test(value) && !value.startsWith("android.test") && value.length <= 40;
}

/** Prix commercial du catalogue, distinct du prix localisé que Play affiche. */
export function commercialCentsForProduct(productId: PlayProductId): number {
  const product = PLAY_PRODUCTS[productId];
  if (product.kind === "upgrade") return UPGRADE_BUSINESS_TO_PLUS_CENTS;
  return CATALOG[product.offerId].priceCents ?? 0;
}

export type PlayPurchaseAccess = "off" | "test" | "public";

/** Fermé par défaut. public n'est accepté que si la valeur est exactement celle-ci. */
export function playPurchaseAccess(value: string | undefined): PlayPurchaseAccess {
  if (value === "public" || value === "test") return value;
  return "off";
}

export function playTestUids(value: string | undefined): string[] {
  return (value || "").split(",").map((item) => item.trim()).filter((item) => item.length > 0 && !/\s/.test(item));
}

export function playPurchaseAllowed(access: PlayPurchaseAccess, uid: string, testUids: readonly string[]): boolean {
  if (!uid) return false;
  if (access === "public") return true;
  if (access === "test") return testUids.includes(uid);
  return false;
}

export function playProductForDue(kind: string, offerId: OfferId): PlayProductId | null {
  if (kind === "upgrade" && offerId === "business_plus") return "souspli_business_plus_upgrade";
  if (kind !== "purchase") return null;
  if (offerId === "association") return "souspli_association_event";
  if (offerId === "business") return "souspli_business_event";
  if (offerId === "business_plus") return "souspli_business_plus_event";
  return null;
}

/** Identifiant opaque envoyé à Play. Pas d'e-mail, 8 à 64 caractères. */
export function isOpaquePlayId(value: string): boolean {
  return /^[A-Za-z0-9_-]{8,64}$/.test(value);
}

export type LedgerStatus = "open" | "pending" | "succeeded" | "canceled" | "failed" | "expired" | "refunded";

export interface LedgerLine {
  id: string;
  status: LedgerStatus;
  offerId: OfferId;
  kind: PlayKind;
  createdAtMs: number;
}

export interface Entitlement {
  commercialStatus: "paid" | "refunded" | "unpaid";
  paidOfferId: OfferId | null;
  paidAmountCents: number;
  activePaymentId: string | null;
}

export function ledgerLineFromPayment(id: string, data: {
  status?: unknown;
  offerId?: unknown;
  kind?: unknown;
  createdAtMs?: unknown;
}, statusOverride?: LedgerStatus): LedgerLine | null {
  if (!isOfferId(data.offerId)) return null;
  const kind = data.kind === "upgrade" ? "upgrade" : data.kind === "purchase" ? "purchase" : null;
  if (!kind) return null;
  const raw = statusOverride ?? String(data.status ?? "");
  const known: LedgerStatus[] = ["open", "pending", "succeeded", "canceled", "failed", "expired", "refunded"];
  if (!(known as string[]).includes(raw)) return null;
  const createdAtMs = Number(data.createdAtMs ?? 0);
  return { id, status: raw as LedgerStatus, offerId: data.offerId, kind, createdAtMs: Number.isFinite(createdAtMs) ? createdAtMs : 0 };
}

/**
 * Recalcule les droits à partir des commandes encore valides.
 * Un remboursement d'une commande ancienne ne retire pas un achat postérieur.
 * Le supplément n'accorde Plus que si une commande Entreprise réussie existe encore avant lui.
 * Les montants sont ceux du catalogue, pas le prix encaissé par Play ou Mollie.
 */
export function entitlementFromLedger(lines: LedgerLine[]): Entitlement {
  const ordered = [...lines].sort((a, b) => a.createdAtMs - b.createdAtMs || a.id.localeCompare(b.id));
  let offer: OfferId | null = null;
  let cents = 0;
  let activePaymentId: string | null = null;
  let sawRefund = false;
  for (const line of ordered) {
    if (line.status === "refunded") {
      sawRefund = true;
      continue;
    }
    if (line.status !== "succeeded") continue;
    if (line.kind === "purchase") {
      offer = line.offerId;
      cents = CATALOG[line.offerId].priceCents ?? 0;
      activePaymentId = line.id;
      continue;
    }
    if (line.kind === "upgrade" && offer === "business") {
      offer = "business_plus";
      cents = (CATALOG.business.priceCents ?? 0) + UPGRADE_BUSINESS_TO_PLUS_CENTS;
      activePaymentId = line.id;
    }
  }
  if (offer) return { commercialStatus: "paid", paidOfferId: offer, paidAmountCents: cents, activePaymentId };
  if (sawRefund) return { commercialStatus: "refunded", paidOfferId: null, paidAmountCents: 0, activePaymentId: null };
  return { commercialStatus: "unpaid", paidOfferId: null, paidAmountCents: 0, activePaymentId: null };
}

export interface OpenPlayOrder {
  id: string;
  productId: string;
  status: "open" | "pending";
  tokenHash: string | null;
  launchUntilMs: number;
}

export type IntentDecision =
  | { action: "reuse"; id: string }
  | { action: "replace"; cancelIds: string[] }
  | { action: "refuse"; message: string };

/** Une commande déjà liée à un jeton, ou un paiement Play en attente, bloque une nouvelle intention. */
export function decidePlayIntent(productId: string, nowMs: number, orders: OpenPlayOrder[]): IntentDecision {
  const blocking = orders.find((order) => order.status === "pending" || order.tokenHash);
  if (blocking) {
    return { action: "refuse", message: "Un achat Google Play est déjà en cours pour cet événement. Aucune autre commande n'est ouverte." };
  }
  const reusable = orders.find((order) => order.status === "open" && order.productId === productId && order.launchUntilMs > nowMs);
  if (reusable) return { action: "reuse", id: reusable.id };
  return { action: "replace", cancelIds: orders.filter((order) => order.status === "open" && !order.tokenHash).map((order) => order.id) };
}

export type PlayPurchaseState = "purchased" | "pending" | "canceled";

export interface PlayReading {
  packageName: string;
  productId: string;
  purchaseState: PlayPurchaseState;
  consumed: boolean;
  acknowledged: boolean;
  obfuscatedAccountId: string;
  obfuscatedProfileId: string;
  orderId: string;
  testPurchase: boolean;
}

export interface PlayOrderView {
  id: string;
  organizerUid: string;
  eventId: string;
  productId: string;
  obfuscatedAccountId: string;
  status: LedgerStatus;
  tokenHash: string | null;
  consumeState: "none" | "due" | "consumed";
  launchUntilMs: number;
}

export interface PurchaseAssessment {
  outcome: "reject" | "pending" | "canceled" | "grant" | "duplicate" | "refund";
  reason: string;
  consume: boolean;
  eventId: string;
  entitlement: Entitlement;
}

export function assessPlayPurchase(input: {
  order: PlayOrderView;
  reading: PlayReading;
  tokenHash: string;
  tokenOwnerPaymentId: string | null;
  callerUid: string;
  nowMs: number;
  ledger: LedgerLine[];
}): PurchaseAssessment {
  const keep = entitlementFromLedger(input.ledger);
  const reject = (reason: string): PurchaseAssessment => ({
    outcome: "reject",
    reason,
    consume: false,
    eventId: input.order.eventId,
    entitlement: keep,
  });
  if (input.callerUid !== input.order.organizerUid) return reject("Cette commande appartient à un autre compte.");
  if (input.reading.packageName !== PLAY_PACKAGE_NAME) return reject("L'application de l'achat ne correspond pas.");
  if (input.reading.productId !== input.order.productId || !isPlayProductId(input.reading.productId)) return reject("Le produit ne correspond pas à la commande.");
  if (input.reading.obfuscatedProfileId !== input.order.id) return reject("L'achat n'est pas lié à cette commande.");
  if (!isOpaquePlayId(input.reading.obfuscatedAccountId) || input.reading.obfuscatedAccountId !== input.order.obfuscatedAccountId) {
    return reject("L'achat n'est pas lié à ce compte.");
  }
  if (input.tokenOwnerPaymentId && input.tokenOwnerPaymentId !== input.order.id) return reject("Ce jeton a déjà servi à une autre commande.");
  if (input.order.tokenHash && input.order.tokenHash !== input.tokenHash) return reject("Cette commande est déjà liée à un autre achat.");
  if (input.reading.purchaseState === "pending") {
    return { outcome: "pending", reason: "Paiement en attente chez Google Play.", consume: false, eventId: input.order.eventId, entitlement: keep };
  }
  if (input.reading.purchaseState === "canceled") {
    if (input.order.status !== "succeeded") {
      return { outcome: "canceled", reason: "Achat annulé.", consume: false, eventId: input.order.eventId, entitlement: keep };
    }
    const next = input.ledger.map((line) => line.id === input.order.id ? { ...line, status: "refunded" as const } : line);
    return { outcome: "refund", reason: "Achat remboursé.", consume: false, eventId: input.order.eventId, entitlement: entitlementFromLedger(next) };
  }
  if (input.order.status === "refunded") return reject("Cette commande est déjà remboursée.");
  const already = input.order.status === "succeeded" && input.order.tokenHash === input.tokenHash;
  const product = PLAY_PRODUCTS[input.reading.productId];
  const grantedLine: LedgerLine = {
    id: input.order.id,
    status: "succeeded",
    offerId: product.offerId,
    kind: product.kind,
    createdAtMs: input.ledger.find((line) => line.id === input.order.id)?.createdAtMs ?? input.nowMs,
  };
  const nextLedger = [
    ...input.ledger.filter((line) => line.id !== input.order.id),
    grantedLine,
  ];
  const entitlement = entitlementFromLedger(nextLedger);
  const consume = !input.reading.consumed && input.order.consumeState !== "consumed";
  if (already) {
    return { outcome: "duplicate", reason: "Achat déjà attribué.", consume, eventId: input.order.eventId, entitlement };
  }
  return { outcome: "grant", reason: "Achat confirmé.", consume, eventId: input.order.eventId, entitlement };
}

export function nextConsume(input: { granted: boolean; consumeState: "none" | "due" | "consumed"; googleConsumed: boolean }): "consume" | "done" | "hold" {
  if (!input.granted) return "hold";
  if (input.googleConsumed || input.consumeState === "consumed") return "done";
  return "consume";
}

export interface PlayNotice {
  kind: "one-time" | "voided";
  packageName: string;
  purchaseToken: string;
  productId: string;
  notificationType: number;
  messageId: string;
  refund: boolean;
}

/** Le corps Pub/Sub ne suffit pas : l'état est relu chez Google avant tout changement de droit. */
export function readPubSubEnvelope(body: unknown): { messageId: string; payload: unknown } | null {
  if (!body || typeof body !== "object" || !("message" in body)) return null;
  const message = (body as { message?: { messageId?: unknown; data?: unknown } }).message;
  const messageId = String(message?.messageId ?? "");
  const data = String(message?.data ?? "");
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(messageId) || !data) return null;
  try {
    const json = Buffer.from(data, "base64").toString("utf8");
    return { messageId, payload: JSON.parse(json) as unknown };
  } catch {
    return null;
  }
}

export function readDeveloperNotification(payload: unknown, messageId: string): PlayNotice | { kind: "ignore"; reason: string } {
  if (!payload || typeof payload !== "object") return { kind: "ignore", reason: "Avis illisible." };
  const note = payload as {
    packageName?: unknown;
    oneTimeProductNotification?: { notificationType?: unknown; purchaseToken?: unknown; sku?: unknown };
    voidedPurchaseNotification?: { purchaseToken?: unknown; orderId?: unknown; productType?: unknown; refundType?: unknown };
    subscriptionNotification?: unknown;
  };
  const packageName = String(note.packageName ?? "");
  if (packageName !== PLAY_PACKAGE_NAME) return { kind: "ignore", reason: "Autre application." };
  if (note.subscriptionNotification) return { kind: "ignore", reason: "Abonnement ignoré." };
  if (note.oneTimeProductNotification) {
    const token = String(note.oneTimeProductNotification.purchaseToken ?? "");
    const sku = String(note.oneTimeProductNotification.sku ?? "");
    const notificationType = Number(note.oneTimeProductNotification.notificationType);
    if (!token || !isPlayProductId(sku) || (notificationType !== 1 && notificationType !== 2)) {
      return { kind: "ignore", reason: "Avis d'achat incomplet." };
    }
    return { kind: "one-time", packageName, purchaseToken: token, productId: sku, notificationType, messageId, refund: notificationType === 2 };
  }
  if (note.voidedPurchaseNotification) {
    const token = String(note.voidedPurchaseNotification.purchaseToken ?? "");
    const productType = Number(note.voidedPurchaseNotification.productType);
    const refundType = Number(note.voidedPurchaseNotification.refundType ?? 1);
    if (!token || productType !== 2) return { kind: "ignore", reason: "Annulation hors achat unique." };
    if (refundType !== 1) return { kind: "ignore", reason: "Remboursement partiel non géré pour une quantité de 1." };
    return { kind: "voided", packageName, purchaseToken: token, productId: "", notificationType: 0, messageId, refund: true };
  }
  return { kind: "ignore", reason: "Avis sans achat unique." };
}

export function readProductPurchaseV2(body: unknown, packageName: string): PlayReading | null {
  if (!body || typeof body !== "object") return null;
  const value = body as {
    purchaseStateContext?: { purchaseState?: unknown };
    acknowledgementState?: unknown;
    obfuscatedExternalAccountId?: unknown;
    obfuscatedExternalProfileId?: unknown;
    orderId?: unknown;
    testPurchase?: unknown;
    productLineItem?: Array<{ productId?: unknown; productOfferDetails?: { consumptionState?: unknown } }>;
  };
  const stateRaw = String(value.purchaseStateContext?.purchaseState ?? "");
  const purchaseState: PlayPurchaseState | null = stateRaw === "PURCHASED" ? "purchased" : stateRaw === "PENDING" ? "pending" : stateRaw === "CANCELLED" ? "canceled" : null;
  const line = value.productLineItem?.[0];
  const productId = String(line?.productId ?? "");
  if (!purchaseState || !productId) return null;
  const consumed = String(line?.productOfferDetails?.consumptionState ?? "") === "CONSUMPTION_STATE_CONSUMED";
  const acknowledged = String(value.acknowledgementState ?? "") === "ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED";
  return {
    packageName,
    productId,
    purchaseState,
    consumed,
    acknowledged,
    obfuscatedAccountId: String(value.obfuscatedExternalAccountId ?? ""),
    obfuscatedProfileId: String(value.obfuscatedExternalProfileId ?? ""),
    orderId: String(value.orderId ?? ""),
    testPurchase: Boolean(value.testPurchase),
  };
}

export function pushClaimsOk(claims: {
  aud?: unknown;
  email?: unknown;
  email_verified?: unknown;
  iss?: unknown;
  exp?: unknown;
}, expected: { audience: string; email: string; nowSec: number }): boolean {
  const issuer = String(claims.iss ?? "");
  const exp = Number(claims.exp ?? 0);
  return claims.email_verified === true
    && String(claims.aud ?? "") === expected.audience
    && String(claims.email ?? "") === expected.email
    && (issuer === "https://accounts.google.com" || issuer === "accounts.google.com")
    && Number.isFinite(exp)
    && exp > expected.nowSec;
}

export function noticeAlreadySeen(stored: boolean): boolean {
  return stored;
}
