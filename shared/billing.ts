import type { ContextKind } from "./domain";
import { publisher } from "./publisher";

/** Formules vendues. Les montants sont en centimes d'euro, autorité côté serveur. */
export const OFFER_IDS = ["family", "association", "business", "business_plus", "quote"] as const;
export type OfferId = (typeof OFFER_IDS)[number];

export type CommercialStatus = "included" | "unpaid" | "pending" | "paid" | "failed" | "canceled" | "expired" | "refunded";
export type PaymentStatus = "pending" | "succeeded" | "canceled" | "failed" | "expired" | "refunded";
export type NoticeOutcome = "succeeded" | "failed" | "canceled" | "expired" | "refunded";

/** Seule montée d'offre annoncée : Entreprise vers Entreprise Plus, avant le tirage. */
export const UPGRADE_BUSINESS_TO_PLUS_CENTS = 2_000;

export interface OfferDefinition {
  id: OfferId;
  title: string;
  priceCents: number | null;
  capacity: number | null;
  contexts: ContextKind[];
  summary: string;
  points: string[];
}

export const CATALOG: Record<OfferId, OfferDefinition> = {
  family: {
    id: "family",
    title: "Famille & amis",
    priceCents: 0,
    capacity: 50,
    contexts: ["family", "friends"],
    summary: "Un événement familial ou entre amis.",
    points: [
      "Jusqu'à 50 participants",
      "Tirage secret classique",
      "Exclusions individuelles et couples",
      "Listes de souhaits et messagerie anonyme",
      "Invitations par e-mail et liens privés",
      "Suivi de l'organisateur",
      "Thèmes et e-mails prêts à l'emploi",
      "Installation sur l'appareil et notifications dans l'application",
      "Aucune publicité",
    ],
  },
  association: {
    id: "association",
    title: "Association",
    priceCents: 990,
    capacity: 100,
    contexts: ["organization"],
    summary: "Un événement associatif, payé une fois par l'organisateur.",
    points: [
      "Jusqu'à 100 participants",
      "Les fonctions de l'offre Famille & amis",
      "Logo sur l'événement et dans les e-mails",
      "Import de tableau",
      "Relances groupées, avec plafonds",
      "Thèmes adaptés aux associations",
    ],
  },
  business: {
    id: "business",
    title: "Entreprise",
    priceCents: 1990,
    capacity: 100,
    contexts: ["organization"],
    summary: "Un événement d'entreprise, jusqu'à 100 participants.",
    points: [
      "Jusqu'à 100 participants",
      "Les fonctions de l'offre Association",
      "Logo et couleurs",
      "E-mails personnalisables : introduction, signature et ton",
      "Exclusions par équipe ou service",
      "Aperçu et envoi d'essai à l'organisateur",
    ],
  },
  business_plus: {
    id: "business_plus",
    title: "Entreprise Plus",
    priceCents: 3990,
    capacity: 300,
    contexts: ["organization"],
    summary: "Un événement d'entreprise, jusqu'à 300 participants.",
    points: [
      "Jusqu'à 300 participants",
      "Les fonctions de l'offre Entreprise",
      "Plusieurs organisateurs autorisés",
      "Suivi de progression par équipe",
      "Les coorganisateurs ne voient pas les attributions secrètes",
    ],
  },
  quote: {
    id: "quote",
    title: "Grand groupe",
    priceCents: null,
    capacity: null,
    contexts: ["organization"],
    summary: "Plus de 300 participants, sur devis, sans paiement automatique.",
    points: ["Plus de 300 participants", "Demande enregistrée", "Aucun débit lancé depuis l'application"],
  },
};

export const PUBLIC_PRICE_CARDS = ["family", "association", "business"] as const;

export const WITHDRAWAL_MS = 14 * 24 * 60 * 60 * 1000;

export const billingPolicy = {
  provider: "mollie" as const,
  realChargesEnabled: false,
  taxRegime: "franchise_base" as const,
  taxNote: `${publisher.taxMention}. Les prix affichés sont les montants finaux. Aucune TVA n'est ajoutée.`,
  promise: "Un paiement par événement. Aucun abonnement. Les participants ne paient jamais.",
  withdrawalNote:
    "Les clients bénéficiant du droit de rétractation peuvent l'exercer dans les quatorze jours suivant la conclusion du contrat. Sous pli rembourse intégralement les demandes recevables formulées dans ce délai, même lorsque l'utilisation du service a commencé. L'activation immédiate ne vaut pas renonciation au droit de rétractation.",
  invoiceNote:
    "L'e-mail de confirmation est un reçu de commande. Le reçu Mollie, lorsqu'il est émis, n'est pas la facture de JavaChrist. Aucune facture numérotée n'est produite ici.",
  preservedNote:
    "L'import de fichier, les exclusions de groupe, les thèmes d'e-mails et la personnalisation déjà présents restent disponibles. Cette grille ne retire pas une fonction existante pour la rendre payante. La capacité, le paiement avant tirage, les coorganisateurs et le suivi par équipe suivent l'offre.",
};

export function isOfferId(value: unknown): value is OfferId {
  return typeof value === "string" && (OFFER_IDS as readonly string[]).includes(value);
}

export function emailOfferRights(offerId: OfferId, status: CommercialStatus): { logo: boolean; subjects: boolean } {
  const entitled = status === "paid" || status === "included";
  const custom = entitled && (offerId === "association" || offerId === "business" || offerId === "business_plus");
  return { logo: custom, subjects: custom };
}

export function defaultOffer(context: ContextKind): OfferId {
  return context === "organization" ? "association" : "family";
}

export function offersForContext(context: ContextKind): OfferDefinition[] {
  return OFFER_IDS.map((id) => CATALOG[id]).filter((offer) => offer.contexts.includes(context));
}

export function assertOfferForContext(context: ContextKind, offerId: OfferId): string | null {
  if (!CATALOG[offerId].contexts.includes(context)) {
    return "Cette offre ne correspond pas au contexte déclaré. Le contexte n'est pas vérifié au-delà de ce choix.";
  }
  return null;
}

export function formatEuros(cents: number): string {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(cents / 100);
}

export function priceLabel(offerId: OfferId): string {
  const price = CATALOG[offerId].priceCents;
  if (price === null) return "Sur devis";
  if (price === 0) return "Gratuit";
  return `${formatEuros(price)} par événement`;
}

export interface CommercialSnapshot {
  offerId: OfferId;
  status: CommercialStatus;
  paidOfferId: OfferId | null;
  paidAmountCents: number;
}

export function readCommercial(data: {
  context?: unknown;
  offerId?: unknown;
  commercialStatus?: unknown;
  paidOfferId?: unknown;
  paidAmountCents?: unknown;
}): CommercialSnapshot {
  const context = data.context === "organization" || data.context === "friends" || data.context === "family" ? data.context : "family";
  const offerId = isOfferId(data.offerId) ? data.offerId : defaultOffer(context);
  const paidOfferId = isOfferId(data.paidOfferId) ? data.paidOfferId : null;
  const paidAmountCents = Number.isFinite(Number(data.paidAmountCents)) ? Math.max(0, Math.round(Number(data.paidAmountCents))) : 0;
  const raw = String(data.commercialStatus ?? "");
  const known: CommercialStatus[] = ["included", "unpaid", "pending", "paid", "failed", "canceled", "expired", "refunded"];
  const status = (known as string[]).includes(raw) ? (raw as CommercialStatus) : CATALOG[offerId].priceCents === 0 ? "included" : "unpaid";
  return { offerId, status, paidOfferId, paidAmountCents };
}

export type DueKind = "included" | "purchase" | "upgrade" | "settled" | "quote" | "blocked";

export interface AmountDue {
  kind: DueKind;
  cents: number;
  message: string;
}

/** Ignore tout montant fourni par le client : le prix vient du catalogue. */
export function amountDue(input: { offerId: OfferId; paidOfferId: OfferId | null; eventStatus: string }): AmountDue {
  if (["drawn", "revealed", "archived", "cancelled"].includes(input.eventStatus)) {
    return {
      kind: "blocked",
      cents: 0,
      message: "Le tirage est lancé ou l'échange est clos. Un paiement supplémentaire ne modifie pas les participants.",
    };
  }
  if (input.offerId === "quote") {
    return { kind: "quote", cents: 0, message: "Le grand groupe se traite sur devis. Aucun paiement n'est lancé." };
  }
  const price = CATALOG[input.offerId].priceCents ?? 0;
  if (price === 0) {
    return { kind: "included", cents: 0, message: "Cette offre est incluse. Aucun paiement n'est demandé." };
  }
  if (input.paidOfferId === input.offerId) {
    return { kind: "settled", cents: 0, message: "Cette offre est déjà payée pour cet événement." };
  }
  if (input.paidOfferId === "business" && input.offerId === "business_plus") {
    return {
      kind: "upgrade",
      cents: UPGRADE_BUSINESS_TO_PLUS_CENTS,
      message: `Le passage à Entreprise Plus coûte ${formatEuros(UPGRADE_BUSINESS_TO_PLUS_CENTS)}, la différence annoncée.`,
    };
  }
  if (input.paidOfferId) {
    return {
      kind: "blocked",
      cents: 0,
      message: "Ce changement d'offre n'a ni supplément ni remboursement automatique. L'offre déjà payée reste en place.",
    };
  }
  return { kind: "purchase", cents: price, message: `${CATALOG[input.offerId].title} : ${formatEuros(price)} pour cet événement.` };
}

export function launchBlock(input: { offerId: OfferId; status: CommercialStatus; paidOfferId: OfferId | null }): string | null {
  const price = CATALOG[input.offerId].priceCents;
  if (input.offerId === "quote" || price === null) {
    return "Le grand groupe n'a pas de paiement automatique. Le tirage n'est pas débloqué par une demande de devis.";
  }
  if (price === 0 || input.status === "included") return null;
  if (input.status === "paid" && input.paidOfferId === input.offerId) return null;
  if (input.status === "pending") return "Confirmation du paiement en cours. Le retour du navigateur ne débloque pas l'offre.";
  return `Le tirage de l'offre ${CATALOG[input.offerId].title} attend une confirmation de paiement côté serveur. Le brouillon reste gratuit.`;
}

export function rosterDecision(count: number, offerId: OfferId): { ok: true } | { ok: false; message: string } {
  const offer = CATALOG[offerId];
  const capacity = offer.capacity ?? 300;
  if (count <= capacity) return { ok: true };
  if (offer.capacity === null) {
    return {
      ok: false,
      message: `Le groupe compte ${count} personnes. Au-delà de 300 participants, la formule Grand groupe se traite sur devis. Personne n'a été retiré et aucun paiement n'a été lancé.`,
    };
  }
  return {
    ok: false,
    message: `Le groupe compte ${count} personnes pour une capacité de ${capacity} (${offer.title}). Personne n'a été retiré. Retirez des participants ou choisissez une offre qui les couvre.`,
  };
}

export function settlementMatches(expectedCents: number, notice: { amountCents: number; currency: string }): boolean {
  return expectedCents === notice.amountCents && notice.currency.toLowerCase() === "eur";
}

export function participantCount(members: Array<{ status?: string }>): number {
  return members.filter((member) => member.status !== "declined").length;
}

export function centsToMollieValue(cents: number): string {
  const safe = Math.max(0, Math.round(cents));
  return `${Math.floor(safe / 100)}.${String(safe % 100).padStart(2, "0")}`;
}

export function mollieValueToCents(value: string): number | null {
  if (!/^\d+\.\d{2}$/.test(value)) return null;
  const [euros, fraction] = value.split(".");
  return Number(euros) * 100 + Number(fraction);
}

export function isMollieCheckoutUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return host === "mollie.com" || host.endsWith(".mollie.com") || host.endsWith(".mollie.nl");
  } catch {
    return false;
  }
}

export interface MollieReading {
  outcome: NoticeOutcome | "pending";
  amountCents: number;
  paymentId: string;
  providerRef: string;
}

/** Le statut vient de l'objet récupéré auprès de Mollie, jamais du corps du webhook. */
export function readMolliePayment(payload: {
  id?: unknown;
  mode?: unknown;
  status?: unknown;
  amount?: { value?: unknown; currency?: unknown };
  amountRefunded?: { value?: unknown };
  metadata?: { paymentId?: unknown };
}): { ok: true; reading: MollieReading } | { ok: false; reason: string } {
  if (payload.mode === "live") return { ok: false, reason: "Paiement réel refusé." };
  if (payload.mode !== "test") return { ok: false, reason: "Mode de paiement inattendu." };
  const providerRef = String(payload.id ?? "");
  const paymentId = String(payload.metadata?.paymentId ?? "");
  if (!/^tr_[A-Za-z0-9]+$/.test(providerRef) || !paymentId) return { ok: false, reason: "Paiement sans référence de commande." };
  const amountCents = mollieValueToCents(String(payload.amount?.value ?? ""));
  if (amountCents === null || String(payload.amount?.currency ?? "").toUpperCase() !== "EUR") {
    return { ok: false, reason: "Montant ou devise illisible." };
  }
  const refunded = mollieValueToCents(String(payload.amountRefunded?.value ?? "0.00"));
  const status = String(payload.status ?? "");
  if (status === "paid" && refunded === amountCents && amountCents > 0) {
    return { ok: true, reading: { outcome: "refunded", amountCents, paymentId, providerRef } };
  }
  if (status === "paid") return { ok: true, reading: { outcome: "succeeded", amountCents, paymentId, providerRef } };
  if (status === "canceled") return { ok: true, reading: { outcome: "canceled", amountCents, paymentId, providerRef } };
  if (status === "expired") return { ok: true, reading: { outcome: "expired", amountCents, paymentId, providerRef } };
  if (status === "failed") return { ok: true, reading: { outcome: "failed", amountCents, paymentId, providerRef } };
  if (status === "open" || status === "pending" || status === "authorized") {
    return { ok: true, reading: { outcome: "pending", amountCents, paymentId, providerRef } };
  }
  return { ok: false, reason: "Statut de paiement inconnu." };
}

export function withdrawalOpen(confirmedAtMs: number, nowMs: number): boolean {
  return Number.isFinite(confirmedAtMs) && nowMs >= confirmedAtMs && nowMs - confirmedAtMs <= WITHDRAWAL_MS;
}

export function canSubmitRefund(state: string): boolean {
  return state === "requested";
}
