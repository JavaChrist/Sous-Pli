import { HttpsError, onRequest } from "firebase-functions/v2/https";
import { z } from "zod";
import {
  CATALOG,
  amountDue,
  assertOfferForContext,
  formatEuros,
  isOfferId,
  participantCount,
  readCommercial,
  rosterDecision,
  canSubmitRefund,
  centsToMollieValue,
  isMollieCheckoutUrl,
  readMolliePayment,
  settlementMatches,
  withdrawalOpen,
  type NoticeOutcome,
  type OfferId,
} from "../../shared/billing";
import { publisher } from "../../shared/publisher";
import { accessEndInstant } from "../../shared/retention";
import { serviceTheme } from "../../shared/email/templates";
import { appConfig } from "../../shared/config";
import { Timestamp } from "firebase-admin/firestore";
import { adminAuth, appOrigin, assertVerifiedIfEmail, callable, consumeRate, db, newId, parse, stamp, userName } from "./admin";
import { audit } from "./audit";
import { readMembers, requireOrganizer } from "./events";
import { queueEmail } from "./mail";
import { templateVars } from "./theme";

const choiceSchema = z.object({
  eventId: z.string().trim().min(8).max(80),
  offerId: z.enum(["family", "association", "business", "business_plus", "quote"]),
});

export const selectOffer = callable(async (request, uid) => {
  const input = parse(choiceSchema, request.data);
  const { ref, data } = await requireOrganizer(input.eventId, uid);
  if (data.organizerUid !== uid) throw new HttpsError("permission-denied", "Seul l'organisateur qui paie peut choisir l'offre.");
  const mismatch = assertOfferForContext(data.context === "organization" ? "organization" : data.context === "friends" ? "friends" : "family", input.offerId);
  if (mismatch) throw new HttpsError("failed-precondition", mismatch);
  const members = await readMembers(input.eventId);
  const fit = rosterDecision(participantCount(members), input.offerId);
  if (!fit.ok) throw new HttpsError("failed-precondition", fit.message);
  const current = readCommercial(data);
  const due = amountDue({ offerId: input.offerId, paidOfferId: current.paidOfferId, eventStatus: String(data.status ?? "draft") });
  if (due.kind === "blocked") throw new HttpsError("failed-precondition", due.message);
  const pending = await db.collection("payments").where("eventId", "==", input.eventId).where("status", "==", "pending").get();
  const batch = db.batch();
  pending.docs.forEach((doc) => batch.update(doc.ref, { status: "canceled", updatedAt: stamp() }));
  const status = due.kind === "included" ? "included" : due.kind === "settled" ? "paid" : "unpaid";
  batch.update(ref, {
    offerId: input.offerId,
    commercialStatus: status,
    updatedAt: stamp(),
  });
  await batch.commit();
  await audit(input.eventId, uid, `offer.${input.offerId}`);
  return { offerId: input.offerId, dueCents: due.cents, kind: due.kind, message: due.message };
});

export const createCheckout = callable(async (request, uid) => {
  const eventId = String((request.data as { eventId?: string })?.eventId ?? "");
  const accepted = (request.data as { acceptedTerms?: boolean })?.acceptedTerms === true;
  const { ref, data } = await requireOrganizer(eventId, uid);
  await assertVerifiedIfEmail(uid);
  if (data.organizerUid !== uid) throw new HttpsError("permission-denied", "Seul l'organisateur paie. Les participants ne règlent rien.");
  const commercial = readCommercial(data);
  const due = amountDue({ offerId: commercial.offerId, paidOfferId: commercial.paidOfferId, eventStatus: String(data.status ?? "draft") });
  if (due.kind === "blocked" || due.kind === "quote") throw new HttpsError("failed-precondition", due.message);
  if (due.kind === "included" || due.kind === "settled" || due.cents === 0) {
    await ref.update({ commercialStatus: due.kind === "included" ? "included" : "paid", updatedAt: stamp() });
    return { status: due.kind, url: null };
  }
  if (!accepted) throw new HttpsError("failed-precondition", "Cochez les conditions applicables. La case n'est pas précochée.");
  const organization = data.context === "organization";
  const acceptedProcessing = (request.data as { acceptedProcessing?: boolean })?.acceptedProcessing === true;
  if (organization && !acceptedProcessing) {
    throw new HttpsError("failed-precondition", "Cochez l'annexe de sous-traitance. Elle est distincte des conditions générales.");
  }
  const mode = checkoutMode();
  if (mode === "missing") {
    throw new HttpsError("failed-precondition", "Mollie n'est pas configuré en mode test. Aucun paiement n'a été créé.");
  }
  const existing = await db.collection("payments").where("eventId", "==", eventId).where("status", "==", "pending").limit(5).get();
  const reusable = existing.docs.find((doc) => Number(doc.data().amountCents) === due.cents && doc.data().offerId === commercial.offerId);
  if (reusable?.data().checkoutUrl) {
    const url = mode === "test" ? `/paiement/test/${reusable.id}` : String(reusable.data().checkoutUrl);
    return { status: "pending", url, paymentId: reusable.id, mode };
  }
  const paymentId = newId();
  const origin = appOrigin();
  const localDate = String(data.localDate ?? "");
  const timeZone = String(data.timeZone ?? appConfig.defaultTimeZone);
  const accessUntil = data.accessUntil?.toDate?.() ?? (localDate ? accessEndInstant(localDate, timeZone) : null);
  if (!accessUntil) throw new HttpsError("failed-precondition", "La date de l'événement est nécessaire pour indiquer la fin d'accès.");
  const contract = {
    eventId,
    organizerUid: uid,
    offerId: commercial.offerId,
    kind: due.kind,
    amountCents: due.cents,
    currency: "EUR",
    status: "pending",
    provider: mode === "mollie" ? "mollie" : "test",
    providerRef: "",
    checkoutUrl: "",
    basePaidCents: commercial.paidAmountCents,
    termsVersion: publisher.termsVersion,
    processingAnnexVersion: organization ? publisher.processingAnnexVersion : null,
    taxMention: publisher.taxMention,
    localDate,
    timeZone,
    accessUntil: Timestamp.fromDate(accessUntil),
    refundState: "none",
    createdAt: stamp(),
    updatedAt: stamp(),
  };
  await db.collection("payments").doc(paymentId).set(contract);
  let checkoutUrl = `/paiement/test/${paymentId}`;
  let providerRef = "";
  if (mode === "mollie") {
    try {
      const opened = await openMolliePayment({
        paymentId,
        amountCents: due.cents,
        description: `${appConfig.name} — ${CATALOG[commercial.offerId].title}`,
        redirectUrl: `${origin}/paiement/retour?payment=${paymentId}`,
        cancelUrl: `${origin}/evenements/${eventId}/reglement`,
      });
      checkoutUrl = opened.checkoutUrl;
      providerRef = opened.providerRef;
    } catch (error) {
      await db.collection("payments").doc(paymentId).set({ status: "failed", updatedAt: stamp() }, { merge: true });
      throw error;
    }
  }
  await db.collection("payments").doc(paymentId).set({ checkoutUrl, providerRef, updatedAt: stamp() }, { merge: true });
  await ref.update({ commercialStatus: "pending", commercialReference: paymentId, updatedAt: stamp() });
  await audit(eventId, uid, "payment.pending");
  return { status: "pending", url: checkoutUrl, paymentId, mode, accessUntil: accessUntil.toISOString() };
});

export const getPaymentStatus = callable(async (request, uid) => {
  const paymentId = String((request.data as { paymentId?: string })?.paymentId ?? "");
  const payment = await db.collection("payments").doc(paymentId).get();
  if (!payment.exists) throw new HttpsError("not-found", "Cette commande est introuvable.");
  if (payment.data()?.organizerUid !== uid && !isOperator(uid)) throw new HttpsError("permission-denied", "Cette commande ne vous appartient pas.");
  if (payment.data()?.status === "pending" && payment.data()?.provider === "mollie" && payment.data()?.providerRef) {
    await refreshMolliePayment(String(payment.data()?.providerRef));
  }
  const fresh = await db.collection("payments").doc(paymentId).get();
  const data = fresh.data() ?? {};
  const confirmedAt = data.confirmedAt?.toMillis?.() ?? 0;
  const refundState = String(data.refundState ?? "none");
  return {
    paymentId,
    status: String(data.status),
    offerId: String(data.offerId),
    amountCents: Number(data.amountCents ?? 0),
    currency: "EUR",
    eventId: String(data.eventId),
    reference: paymentId,
    taxMention: publisher.taxMention,
    accessUntil: data.accessUntil?.toDate?.()?.toISOString?.() ?? null,
    refundState,
    canRequestWithdrawal: String(data.status) === "succeeded" && withdrawalOpen(confirmedAt, Date.now()) && refundState === "none",
    canProcessWithdrawal: isOperator(uid) && canSubmitRefund(refundState),
  };
});

export const simulateProviderNotice = callable(async (request, uid) => {
  if (process.env.FUNCTIONS_EMULATOR !== "true") {
    throw new HttpsError("permission-denied", "La simulation du prestataire n'existe que dans l'émulateur local.");
  }
  const paymentId = String((request.data as { paymentId?: string })?.paymentId ?? "");
  const outcome = String((request.data as { outcome?: string })?.outcome ?? "");
  if (outcome !== "succeeded" && outcome !== "failed" && outcome !== "canceled" && outcome !== "expired" && outcome !== "refunded") {
    throw new HttpsError("invalid-argument", "Avis de prestataire inconnu.");
  }
  const payment = await db.collection("payments").doc(paymentId).get();
  if (!payment.exists || payment.data()?.organizerUid !== uid) {
    throw new HttpsError("permission-denied", "Cette commande ne vous appartient pas.");
  }
  await applyNotice({
    paymentId,
    outcome,
    amountCents: Number(payment.data()?.amountCents ?? 0),
    currency: "eur",
    providerRef: `test_${paymentId}`,
    noticeId: `test_${paymentId}_${outcome}`,
  });
  const fresh = await db.collection("payments").doc(paymentId).get();
  return { status: String(fresh.data()?.status ?? "pending"), reference: paymentId };
});

const quoteSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().email("Adresse e-mail invalide."),
  organization: z.string().trim().min(2).max(120),
  participants: z.number().int().min(301).max(100000),
  eventDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Indiquez la date de l'événement."),
  need: z.string().trim().min(10).max(2000),
});

export const submitQuote = callable(async (request) => {
  const input = parse(quoteSchema, request.data);
  await consumeRate(`quote_${input.email.toLowerCase()}`, 5, 60 * 60 * 1000, "Trop de demandes de devis. Réessayez plus tard.");
  const id = newId();
  await db.collection("quoteRequests").doc(id).set({
    ...input,
    email: input.email.toLowerCase(),
    emailed: false,
    createdAt: stamp(),
  });
  return {
    recorded: true,
    emailed: false,
    message: "Demande enregistrée. Aucun e-mail n'a été envoyé et aucun paiement n'a été lancé.",
  };
}, { auth: false });

export const addCoOrganizer = callable(async (request, uid) => {
  const eventId = String((request.data as { eventId?: string })?.eventId ?? "");
  const email = String((request.data as { email?: string })?.email ?? "").trim().toLowerCase();
  const { ref, data } = await requireOrganizer(eventId, uid);
  if (data.organizerUid !== uid) throw new HttpsError("permission-denied", "Seul l'organisateur principal ajoute un coorganisateur.");
  const commercial = readCommercial(data);
  if (commercial.paidOfferId !== "business_plus" || commercial.status !== "paid") {
    throw new HttpsError("failed-precondition", "Les coorganisateurs font partie d'Entreprise Plus après confirmation du paiement.");
  }
  let account: { uid: string };
  try {
    account = await adminAuth.getUserByEmail(email);
  } catch {
    throw new HttpsError("not-found", "Cette personne doit d'abord avoir un compte Sous pli. Aucun accès n'a été ouvert.");
  }
  if (account.uid === uid) throw new HttpsError("invalid-argument", "Vous êtes déjà l'organisateur principal.");
  await ref.collection("coOrganizers").doc(account.uid).set({ email, participates: false, updatedAt: stamp() });
  await db.collection("users").doc(account.uid).collection("coEvents").doc(eventId).set({
    eventId,
    eventName: String(data.name ?? "Échange"),
    updatedAt: stamp(),
  });
  await audit(eventId, uid, "organizer.add");
  return { uid: account.uid };
});

export const removeCoOrganizer = callable(async (request, uid) => {
  const eventId = String((request.data as { eventId?: string })?.eventId ?? "");
  const coUid = String((request.data as { uid?: string })?.uid ?? "");
  const { ref, data } = await requireOrganizer(eventId, uid);
  if (data.organizerUid !== uid) throw new HttpsError("permission-denied", "Seul l'organisateur principal retire un coorganisateur.");
  await ref.collection("coOrganizers").doc(coUid).delete();
  await db.collection("users").doc(coUid).collection("coEvents").doc(eventId).delete();
  await audit(eventId, uid, "organizer.remove");
  return { ok: true };
});

export const requestWithdrawal = callable(async (request, uid) => {
  const paymentId = String((request.data as { paymentId?: string })?.paymentId ?? "");
  const paymentRef = db.collection("payments").doc(paymentId);
  const payment = await paymentRef.get();
  if (!payment.exists || payment.data()?.organizerUid !== uid) {
    throw new HttpsError("permission-denied", "Cette commande ne vous appartient pas.");
  }
  const data = payment.data() ?? {};
  if (String(data.status) !== "succeeded") throw new HttpsError("failed-precondition", "Seule une commande payée peut faire l'objet d'une rétractation.");
  const confirmedAt = data.confirmedAt?.toMillis?.() ?? 0;
  if (!withdrawalOpen(confirmedAt, Date.now())) {
    throw new HttpsError("failed-precondition", "Le délai de quatorze jours à compter de la confirmation est dépassé.");
  }
  const state = String(data.refundState ?? "none");
  if (state === "requested" || state === "submitted" || state === "refunded") {
    return { status: state, message: "Une demande existe déjà pour cette commande." };
  }
  await paymentRef.set({ refundState: "requested", withdrawalRequestedAt: stamp(), updatedAt: stamp() }, { merge: true });
  await sendReceipt(String(data.eventId), "withdrawal_requested", data, paymentId);
  return { status: "requested", message: "Demande enregistrée. Le remboursement part après traitement par une personne habilitée et confirmation de Mollie." };
});

export const processWithdrawal = callable(async (request, uid) => {
  if (!isOperator(uid)) throw new HttpsError("permission-denied", "Cette action est réservée à une personne habilitée.");
  const paymentId = String((request.data as { paymentId?: string })?.paymentId ?? "");
  const paymentRef = db.collection("payments").doc(paymentId);
  const payment = await paymentRef.get();
  if (!payment.exists) throw new HttpsError("not-found", "Cette commande est introuvable.");
  const data = payment.data() ?? {};
  if (!canSubmitRefund(String(data.refundState ?? "none"))) {
    throw new HttpsError("failed-precondition", "Aucun remboursement en double : la demande n'est pas en attente de traitement.");
  }
  const providerRef = String(data.providerRef ?? "");
  if (data.provider === "test") {
    await applyNotice({
      paymentId,
      outcome: "refunded",
      amountCents: Number(data.amountCents ?? 0),
      currency: "eur",
      providerRef: providerRef || `test_${paymentId}`,
      noticeId: `refund_${paymentId}`,
    });
    await paymentRef.set({ refundState: "refunded", updatedAt: stamp() }, { merge: true });
    return { status: "refunded" };
  }
  if (!providerRef) throw new HttpsError("failed-precondition", "Le paiement Mollie n'a pas de référence.");
  const key = mollieKey();
  const response = await fetch(`https://api.mollie.com/v2/payments/${encodeURIComponent(providerRef)}/refunds`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      "Idempotency-Key": `refund-${paymentId}`,
    },
    body: JSON.stringify({ amount: { currency: "EUR", value: centsToMollieValue(Number(data.amountCents ?? 0)) } }),
  });
  if (!response.ok && response.status !== 409) {
    throw new HttpsError("internal", "Mollie n'a pas accepté le remboursement. Aucun second envoi n'est lancé.");
  }
  await paymentRef.set({ refundState: "submitted", updatedAt: stamp() }, { merge: true });
  await refreshMolliePayment(providerRef);
  const fresh = await paymentRef.get();
  return { status: String(fresh.data()?.status ?? "succeeded"), refundState: String(fresh.data()?.refundState ?? "submitted") };
});

export const mollieWebhook = onRequest({ region: "europe-west1", cors: false, memory: "256MiB", cpu: 0.167, maxInstances: 1 }, async (request, response) => {
  if (request.method !== "POST") {
    response.status(405).send("Méthode refusée");
    return;
  }
  const providerRef = readWebhookId(request.body, request.rawBody?.toString("utf8") ?? "");
  if (!providerRef) {
    response.status(400).send("Identifiant absent");
    return;
  }
  try {
    await refreshMolliePayment(providerRef);
    response.status(200).send("ok");
  } catch (error) {
    console.error("Avis Mollie refusé", error instanceof Error ? error.name : "erreur");
    response.status(500).send("Traitement impossible");
  }
});

function checkoutMode(): "mollie" | "test" | "missing" {
  const key = process.env.MOLLIE_API_KEY || "";
  if (key.startsWith("live_")) return "missing";
  if (key.startsWith("test_")) return "mollie";
  if (process.env.FUNCTIONS_EMULATOR === "true") return "test";
  return "missing";
}

function mollieKey(): string {
  const key = process.env.MOLLIE_API_KEY || "";
  if (!key.startsWith("test_")) throw new HttpsError("failed-precondition", "La clé Mollie de test est absente. Aucun paiement réel n'est ouvert.");
  return key;
}

function isOperator(uid: string): boolean {
  return (process.env.MOLLIE_OPERATOR_UIDS || "").split(",").map((item) => item.trim()).filter(Boolean).includes(uid);
}

function readWebhookId(body: unknown, raw: string): string {
  const fromBody = typeof body === "object" && body && "id" in body ? String((body as { id?: string }).id ?? "") : "";
  const fromRaw = new URLSearchParams(raw).get("id") ?? "";
  const id = fromBody || fromRaw;
  return /^tr_[A-Za-z0-9]+$/.test(id) ? id : "";
}

async function openMolliePayment(input: {
  paymentId: string;
  amountCents: number;
  description: string;
  redirectUrl: string;
  cancelUrl: string;
}): Promise<{ checkoutUrl: string; providerRef: string }> {
  const webhookUrl = process.env.MOLLIE_WEBHOOK_URL || "";
  const body: Record<string, unknown> = {
    amount: { currency: "EUR", value: centsToMollieValue(input.amountCents) },
    description: input.description.slice(0, 255),
    redirectUrl: input.redirectUrl,
    cancelUrl: input.cancelUrl,
    locale: "fr_FR",
    metadata: { paymentId: input.paymentId },
  };
  if (webhookUrl.startsWith("https://")) body.webhookUrl = webhookUrl;
  const response = await fetch("https://api.mollie.com/v2/payments", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${mollieKey()}`,
      "Content-Type": "application/json",
      "Idempotency-Key": `payment-${input.paymentId}`,
    },
    body: JSON.stringify(body),
  });
  const payload = (await response.json()) as { id?: string; _links?: { checkout?: { href?: string } } };
  const checkoutUrl = String(payload._links?.checkout?.href ?? "");
  if (!response.ok || !payload.id || !isMollieCheckoutUrl(checkoutUrl)) {
    throw new HttpsError("internal", "Mollie n'a pas ouvert le paiement de test. Aucun débit n'est confirmé.");
  }
  return { checkoutUrl, providerRef: payload.id };
}

async function refreshMolliePayment(providerRef: string) {
  const response = await fetch(`https://api.mollie.com/v2/payments/${encodeURIComponent(providerRef)}`, {
    headers: { Authorization: `Bearer ${mollieKey()}` },
  });
  const payload = (await response.json()) as Parameters<typeof readMolliePayment>[0];
  if (!response.ok) throw new Error("Lecture Mollie impossible");
  const reading = readMolliePayment(payload);
  if (!reading.ok) throw new Error(reading.reason);
  if (reading.reading.outcome === "pending") return;
  await applyNotice({
    paymentId: reading.reading.paymentId,
    outcome: reading.reading.outcome,
    amountCents: reading.reading.amountCents,
    currency: "eur",
    providerRef: reading.reading.providerRef,
    noticeId: `${reading.reading.providerRef}:${reading.reading.outcome}`,
  });
}

async function applyNotice(input: {
  paymentId: string;
  outcome: NoticeOutcome;
  amountCents: number;
  currency: string;
  providerRef: string;
  noticeId: string;
}) {
  const paymentRef = db.collection("payments").doc(input.paymentId);
  const noticeRef = db.collection("paymentNotices").doc(input.noticeId);
  const effect = await db.runTransaction(async (tx) => {
    const seen = await tx.get(noticeRef);
    if (seen.exists) return { email: null as null };
    const paymentSnap = await tx.get(paymentRef);
    if (!paymentSnap.exists) throw new Error("Commande introuvable");
    const payment = paymentSnap.data() ?? {};
    const eventRef = db.collection("events").doc(String(payment.eventId));
    const status = String(payment.status);
    if (input.outcome === "succeeded") {
      if (status !== "pending") {
        tx.set(noticeRef, { paymentId: input.paymentId, ignored: status, at: stamp() });
        return { email: null as null };
      }
      const matches = settlementMatches(Number(payment.amountCents), { amountCents: input.amountCents, currency: input.currency });
      if (!matches || !isOfferId(payment.offerId)) {
        tx.update(paymentRef, { status: "failed", updatedAt: stamp() });
        tx.update(eventRef, { commercialStatus: "failed", updatedAt: stamp() });
        tx.set(noticeRef, { paymentId: input.paymentId, outcome: "rejected", at: stamp() });
        return { email: "payment_failed" as const, payment, eventId: String(payment.eventId) };
      }
      const paidAmount = payment.kind === "upgrade" ? Number(payment.basePaidCents ?? 0) + Number(payment.amountCents) : Number(payment.amountCents);
      tx.update(paymentRef, { status: "succeeded", providerRef: input.providerRef, confirmedAt: stamp(), updatedAt: stamp() });
      tx.update(eventRef, {
        offerId: payment.offerId,
        commercialStatus: "paid",
        paidOfferId: payment.offerId,
        paidAmountCents: paidAmount,
        commercialReference: input.paymentId,
        termsVersion: payment.termsVersion ?? publisher.termsVersion,
        accessUntil: payment.accessUntil ?? null,
        accessUntilLocked: true,
        timeZone: payment.timeZone ?? appConfig.defaultTimeZone,
        updatedAt: stamp(),
      });
      tx.set(noticeRef, { paymentId: input.paymentId, outcome: "succeeded", at: stamp() });
      return { email: payment.kind === "upgrade" ? "offer_changed" as const : "payment_confirmed" as const, payment, eventId: String(payment.eventId) };
    }
    if (input.outcome === "refunded") {
      if (status !== "succeeded" || !settlementMatches(Number(payment.amountCents), { amountCents: input.amountCents, currency: input.currency })) {
        tx.set(noticeRef, { paymentId: input.paymentId, outcome: "refund-ignored", at: stamp() });
        return { email: null as null };
      }
      tx.update(paymentRef, { status: "refunded", refundState: "refunded", updatedAt: stamp() });
      tx.update(eventRef, { commercialStatus: "refunded", paidOfferId: null, paidAmountCents: 0, updatedAt: stamp() });
      tx.set(noticeRef, { paymentId: input.paymentId, outcome: "refunded", at: stamp() });
      return { email: "refund_confirmed" as const, payment, eventId: String(payment.eventId) };
    }
    if (status !== "pending") {
      tx.set(noticeRef, { paymentId: input.paymentId, ignored: status, at: stamp() });
      return { email: null as null };
    }
    const next = input.outcome === "canceled" ? "canceled" : input.outcome === "expired" ? "expired" : "failed";
    tx.update(paymentRef, { status: next, updatedAt: stamp() });
    tx.update(eventRef, { commercialStatus: next === "canceled" ? "canceled" : "failed", updatedAt: stamp() });
    tx.set(noticeRef, { paymentId: input.paymentId, outcome: next, at: stamp() });
    return { email: next === "failed" ? "payment_failed" as const : null, payment, eventId: String(payment.eventId) };
  });
  if (!effect.email || !effect.eventId) return;
  await sendReceipt(effect.eventId, effect.email, effect.payment as Record<string, unknown>, input.paymentId);
}

async function sendReceipt(eventId: string, template: "payment_confirmed" | "payment_failed" | "offer_changed" | "refund_confirmed" | "withdrawal_requested", payment: Record<string, unknown>, paymentId: string) {
  const event = await db.collection("events").doc(eventId).get();
  const data = event.data() ?? {};
  const organizerUid = String(payment.organizerUid ?? data.organizerUid ?? "");
  let email = "";
  try {
    email = (await adminAuth.getUser(organizerUid)).email ?? "";
  } catch {
    email = "";
  }
  if (!email) return;
  const offerId = isOfferId(payment.offerId) ? payment.offerId : "family";
  const theme = serviceTheme();
  const name = await userName(organizerUid);
  const vars = templateVars(data, name, appConfig.name, `${appOrigin()}/evenements/${eventId}/reglement`);
  await queueEmail({
    idempotencyKey: `pay:${paymentId}:${template}`,
    to: email,
    uid: organizerUid,
    eventId,
    templateId: template,
    theme,
    vars: {
      ...vars,
      offre: CATALOG[offerId].title,
      montant: formatEuros(Number(payment.amountCents ?? 0)),
      reference: paymentId,
      devise: "EUR",
      mention_fiscale: publisher.taxMention,
    },
  });
}
