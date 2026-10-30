import { createHash, randomBytes } from "node:crypto";
import { GoogleAuth, OAuth2Client } from "google-auth-library";
import { Timestamp, type QueryDocumentSnapshot } from "firebase-admin/firestore";
import { HttpsError, onRequest } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { z } from "zod";
import { accessEndInstant } from "../../shared/retention";
import { appConfig } from "../../shared/config";
import { publisher } from "../../shared/publisher";
import { amountDue, assertOfferForContext, participantCount, readCommercial, rosterDecision } from "../../shared/billing";
import {
  PLAY_LAUNCH_WINDOW_MS,
  PLAY_PACKAGE_NAME,
  assessPlayPurchase,
  decidePlayIntent,
  entitlementFromLedger,
  isOpaquePlayId,
  isPlayProductId,
  ledgerLineFromPayment,
  nextConsume,
  playProductForDue,
  playPurchaseAccess,
  playPurchaseAllowed,
  playTestUids,
  pushClaimsOk,
  readDeveloperNotification,
  readProductPurchaseV2,
  readPubSubEnvelope,
  type LedgerLine,
  type LedgerStatus,
  type PlayReading,
} from "../../shared/play";
import { adminAuth, assertVerifiedIfEmail, callable, db, newId, parse, stamp } from "./admin";
import { audit } from "./audit";
import { sendReceipt } from "./billing";
import { readMembers, refreshTeamProgress, requireOrganizer } from "./events";

const publisherScope = "https://www.googleapis.com/auth/androidpublisher";
const playRuntimeAccount = "861168351586-compute@developer.gserviceaccount.com";
const playRuntime = { serviceAccount: playRuntimeAccount };

function purchaseOpen(uid: string): boolean {
  return playPurchaseAllowed(playPurchaseAccess(process.env.PLAY_PURCHASE_ACCESS), uid, playTestUids(process.env.PLAY_TEST_UIDS));
}

function tokenHash(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

interface PlayGateway {
  read(token: string): Promise<PlayReading | null>;
  consume(productId: string, token: string): Promise<boolean>;
}

function playGateway(): PlayGateway {
  const auth = new GoogleAuth({ scopes: [publisherScope] });
  return {
    async read(token: string) {
      const client = await auth.getClient();
      const url = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${PLAY_PACKAGE_NAME}/purchases/productsv2/tokens/${encodeURIComponent(token)}`;
      const response = await client.request<unknown>({ url, method: "GET" });
      return readProductPurchaseV2(response.data, PLAY_PACKAGE_NAME);
    },
    async consume(productId: string, token: string) {
      const client = await auth.getClient();
      const url = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${PLAY_PACKAGE_NAME}/purchases/products/${encodeURIComponent(productId)}/tokens/${encodeURIComponent(token)}:consume`;
      const response = await client.request({ url, method: "POST" });
      return response.status === 200 || response.status === 204;
    },
  };
}

function linesOf(docs: QueryDocumentSnapshot[], override?: { id: string; status: LedgerStatus }): LedgerLine[] {
  return docs.flatMap((doc) => {
    const data = doc.data();
    const line = ledgerLineFromPayment(doc.id, {
      status: data.status,
      offerId: data.offerId,
      kind: data.kind,
      createdAtMs: Number(data.createdAtMs ?? data.createdAt?.toMillis?.() ?? 0),
    }, override && override.id === doc.id ? override.status : undefined);
    return line ? [line] : [];
  });
}

async function accountKey(uid: string): Promise<string> {
  const ref = db.collection("users").doc(uid);
  const snap = await ref.get();
  const current = String(snap.data()?.playAccountId ?? "");
  if (isOpaquePlayId(current)) return current;
  const created = randomBytes(16).toString("hex");
  await ref.set({ playAccountId: created, updatedAt: stamp() }, { merge: true });
  return created;
}

const orderSchema = z.object({
  eventId: z.string().trim().min(8).max(80),
  acceptedTerms: z.literal(true),
  acceptedProcessing: z.boolean().optional(),
});

export const createPlayOrder = callable(async (request, uid) => {
  if (!purchaseOpen(uid)) {
    throw new HttpsError("permission-denied", "Les achats Google Play ne sont pas ouverts pour ce compte. Aucun paiement n'est lancé.");
  }
  const input = parse(orderSchema, request.data);
  const { ref, data } = await requireOrganizer(input.eventId, uid);
  await assertVerifiedIfEmail(uid);
  if (data.organizerUid !== uid) throw new HttpsError("permission-denied", "Seul l'organisateur paie. Les participants ne règlent rien.");
  const context = data.context === "organization" ? "organization" : data.context === "friends" ? "friends" : "family";
  const commercial = readCommercial(data);
  const mismatch = assertOfferForContext(context, commercial.offerId);
  if (mismatch) throw new HttpsError("failed-precondition", mismatch);
  if (context === "organization" && input.acceptedProcessing !== true) {
    throw new HttpsError("failed-precondition", "Cochez l'annexe de sous-traitance. Elle est distincte des conditions générales.");
  }
  const members = await readMembers(input.eventId);
  const fit = rosterDecision(participantCount(members), commercial.offerId);
  if (!fit.ok) throw new HttpsError("failed-precondition", fit.message);
  const due = amountDue({ offerId: commercial.offerId, paidOfferId: commercial.paidOfferId, eventStatus: String(data.status ?? "draft") });
  const productId = playProductForDue(due.kind, commercial.offerId);
  if (!productId || due.cents <= 0) throw new HttpsError("failed-precondition", due.message);
  const localDate = String(data.localDate ?? "");
  const timeZone = String(data.timeZone ?? appConfig.defaultTimeZone);
  const accessUntil = data.accessUntil?.toDate?.() ?? (localDate ? accessEndInstant(localDate, timeZone) : null);
  if (!accessUntil) throw new HttpsError("failed-precondition", "La date de l'événement est nécessaire pour indiquer la fin d'accès.");
  const obfuscatedAccountId = await accountKey(uid);
  const now = Date.now();
  const created = await db.runTransaction(async (tx) => {
    const existing = await tx.get(db.collection("payments").where("eventId", "==", input.eventId));
    const playOrders = existing.docs.flatMap((doc) => {
      const data = doc.data();
      if (data.provider !== "google_play" || (data.status !== "open" && data.status !== "pending")) return [];
      return [{ id: doc.id, data }];
    });
    if (existing.docs.some((doc) => doc.data().provider !== "google_play" && doc.data().status === "pending")) {
      return { error: "Un paiement est déjà en cours pour cet événement. Aucune autre commande n'est ouverte." };
    }
    const decision = decidePlayIntent(productId, now, playOrders.map((doc) => ({
      id: doc.id,
      productId: String(doc.data.playProductId ?? ""),
      status: doc.data.status === "pending" ? "pending" as const : "open" as const,
      tokenHash: doc.data.tokenHash ? String(doc.data.tokenHash) : null,
      launchUntilMs: Number(doc.data.launchUntilMs ?? 0),
    })));
    if (decision.action === "refuse") return { error: decision.message };
    if (decision.action === "reuse") {
      const reused = playOrders.find((doc) => doc.id === decision.id);
      return {
        paymentId: decision.id,
        obfuscatedAccountId: String(reused?.data.obfuscatedAccountId ?? obfuscatedAccountId),
      };
    }
    decision.cancelIds.forEach((id) => {
      tx.update(db.collection("payments").doc(id), { status: "canceled", updatedAt: stamp() });
    });
    const paymentId = newId();
    tx.set(db.collection("payments").doc(paymentId), {
      eventId: input.eventId,
      organizerUid: uid,
      offerId: commercial.offerId,
      kind: due.kind,
      amountCents: due.cents,
      commercialCents: due.cents,
      currency: "EUR",
      status: "open",
      provider: "google_play",
      providerRef: "",
      playProductId: productId,
      obfuscatedAccountId,
      obfuscatedProfileId: paymentId,
      tokenHash: null,
      consumeState: "none",
      launchUntilMs: now + PLAY_LAUNCH_WINDOW_MS,
      basePaidCents: commercial.paidAmountCents,
      termsVersion: publisher.termsVersion,
      processingAnnexVersion: context === "organization" ? publisher.processingAnnexVersion : null,
      taxMention: publisher.taxMention,
      localDate,
      timeZone,
      accessUntil: Timestamp.fromDate(accessUntil),
      refundState: "none",
      createdAtMs: now,
      createdAt: stamp(),
      updatedAt: stamp(),
    });
    return { paymentId, obfuscatedAccountId };
  });
  if ("error" in created) throw new HttpsError("failed-precondition", created.error ?? "Commande impossible.");
  await audit(input.eventId, uid, "play.open");
  return {
    paymentId: created.paymentId,
    productId,
    obfuscatedAccountId: created.obfuscatedAccountId,
    obfuscatedProfileId: created.paymentId,
  };
}, playRuntime);

async function applyVerifiedPurchase(callerUid: string, token: string, claimedProductId: string | null, noticeId: string | null) {
  const gateway = playGateway();
  let reading: PlayReading | null = null;
  try {
    reading = await gateway.read(token);
  } catch {
    throw new HttpsError("unavailable", "La vérification Google Play a échoué. Aucun droit n'est accordé.");
  }
  if (!reading || (claimedProductId && claimedProductId !== reading.productId)) {
    throw new HttpsError("failed-precondition", "Cet achat n'est pas vérifié. Aucun droit n'est accordé.");
  }
  const hash = tokenHash(token);
  const paymentRef = db.collection("payments").doc(reading.obfuscatedProfileId);
  const tokenRef = db.collection("playPurchases").doc(hash);
  const noticeRef = noticeId ? db.collection("playNotices").doc(noticeId) : null;
  const effect = await db.runTransaction(async (tx) => {
    if (noticeRef) {
      const seen = await tx.get(noticeRef);
      if (seen.exists) return { kind: "duplicate" as const, eventId: "", entitlementPaid: false, consume: false, email: null as null, payment: null as Record<string, unknown> | null };
    }
    const paymentSnap = await tx.get(paymentRef);
    if (!paymentSnap.exists) {
      if (noticeRef) tx.set(noticeRef, { unmatched: true, at: stamp() });
      return { kind: "missing" as const, eventId: "", entitlementPaid: false, consume: false, email: null as null, payment: null as Record<string, unknown> | null };
    }
    const payment = paymentSnap.data() ?? {};
    const eventId = String(payment.eventId ?? "");
    const siblings = await tx.get(db.collection("payments").where("eventId", "==", eventId));
    const tokenSnap = await tx.get(tokenRef);
    const owner = tokenSnap.exists ? String(tokenSnap.data()?.paymentId ?? "") : null;
    const ledger = linesOf(siblings.docs);
    const orderLine = ledgerLineFromPayment(paymentSnap.id, {
      status: payment.status,
      offerId: payment.offerId,
      kind: payment.kind,
      createdAtMs: Number(payment.createdAtMs ?? payment.createdAt?.toMillis?.() ?? 0),
    });
    const assessment = assessPlayPurchase({
      order: {
        id: paymentSnap.id,
        organizerUid: String(payment.organizerUid ?? ""),
        eventId,
        productId: String(payment.playProductId ?? ""),
        obfuscatedAccountId: String(payment.obfuscatedAccountId ?? ""),
        status: orderLine?.status ?? "open",
        tokenHash: payment.tokenHash ? String(payment.tokenHash) : null,
        consumeState: payment.consumeState === "consumed" || payment.consumeState === "due" ? payment.consumeState : "none",
        launchUntilMs: Number(payment.launchUntilMs ?? 0),
      },
      reading,
      tokenHash: hash,
      tokenOwnerPaymentId: owner,
      callerUid,
      nowMs: Date.now(),
      ledger,
    });
    if (assessment.outcome === "reject") {
      return { kind: "reject" as const, reason: assessment.reason, eventId, entitlementPaid: false, consume: false, email: null as null, payment: null as Record<string, unknown> | null };
    }
    const eventRef = db.collection("events").doc(eventId);
    if (assessment.outcome === "pending") {
      tx.update(paymentRef, { status: "pending", tokenHash: hash, providerRef: reading.orderId, updatedAt: stamp() });
      tx.set(tokenRef, { paymentId: paymentSnap.id, productId: reading.productId, organizerUid: payment.organizerUid, eventId, purchaseToken: token, consumeState: "none", updatedAt: stamp() }, { merge: true });
      tx.update(eventRef, { commercialStatus: "pending", updatedAt: stamp() });
      if (noticeRef) tx.set(noticeRef, { paymentId: paymentSnap.id, outcome: "pending", at: stamp() });
      return { kind: "pending" as const, eventId, entitlementPaid: false, consume: false, email: null as null, payment };
    }
    if (assessment.outcome === "canceled") {
      tx.update(paymentRef, { status: "canceled", tokenHash: hash, providerRef: reading.orderId, updatedAt: stamp() });
      tx.set(tokenRef, { paymentId: paymentSnap.id, productId: reading.productId, organizerUid: payment.organizerUid, eventId, purchaseToken: token, consumeState: "none", updatedAt: stamp() }, { merge: true });
      const restored = assessment.entitlement;
      tx.update(eventRef, {
        commercialStatus: restored.commercialStatus === "paid" ? "paid" : "canceled",
        paidOfferId: restored.paidOfferId,
        paidAmountCents: restored.paidAmountCents,
        updatedAt: stamp(),
      });
      if (noticeRef) tx.set(noticeRef, { paymentId: paymentSnap.id, outcome: "canceled", at: stamp() });
      return { kind: "canceled" as const, eventId, entitlementPaid: false, consume: false, email: null as null, payment };
    }
    if (assessment.outcome === "refund") {
      tx.update(paymentRef, { status: "refunded", refundState: "refunded", updatedAt: stamp() });
      tx.update(eventRef, {
        ...(assessment.entitlement.paidOfferId ? { offerId: assessment.entitlement.paidOfferId } : {}),
        commercialStatus: assessment.entitlement.commercialStatus,
        paidOfferId: assessment.entitlement.paidOfferId,
        paidAmountCents: assessment.entitlement.paidAmountCents,
        updatedAt: stamp(),
      });
      if (noticeRef) tx.set(noticeRef, { paymentId: paymentSnap.id, outcome: "refunded", at: stamp() });
      return { kind: "refund" as const, eventId, entitlementPaid: assessment.entitlement.commercialStatus === "paid", consume: false, email: "refund_confirmed" as const, payment };
    }
    const consumeState = nextConsume({
      granted: true,
      consumeState: payment.consumeState === "consumed" ? "consumed" : "due",
      googleConsumed: reading.consumed,
    }) === "done" ? "consumed" : "due";
    const fresh = assessment.outcome === "grant";
    if (fresh) {
      tx.update(paymentRef, {
        status: "succeeded",
        tokenHash: hash,
        providerRef: reading.orderId,
        consumeState,
        confirmedAt: stamp(),
        updatedAt: stamp(),
      });
      tx.update(eventRef, {
        offerId: assessment.entitlement.paidOfferId,
        commercialStatus: "paid",
        paidOfferId: assessment.entitlement.paidOfferId,
        paidAmountCents: assessment.entitlement.paidAmountCents,
        commercialReference: assessment.entitlement.activePaymentId,
        termsVersion: payment.termsVersion ?? publisher.termsVersion,
        accessUntil: payment.accessUntil ?? null,
        accessUntilLocked: true,
        timeZone: payment.timeZone ?? appConfig.defaultTimeZone,
        updatedAt: stamp(),
      });
    } else if (consumeState === "consumed") {
      tx.update(paymentRef, { consumeState: "consumed", updatedAt: stamp() });
    }
    tx.set(tokenRef, {
      paymentId: paymentSnap.id,
      productId: reading.productId,
      organizerUid: payment.organizerUid,
      eventId,
      purchaseToken: token,
      consumeState,
      updatedAt: stamp(),
    }, { merge: true });
    if (noticeRef) tx.set(noticeRef, { paymentId: paymentSnap.id, outcome: fresh ? "succeeded" : "duplicate", at: stamp() });
    return {
      kind: fresh ? "grant" as const : "duplicate" as const,
      eventId,
      entitlementPaid: true,
      consume: assessment.consume,
      email: fresh ? (payment.kind === "upgrade" ? "offer_changed" as const : "payment_confirmed" as const) : null,
      payment,
    };
  });
  if (effect.kind === "reject") throw new HttpsError("failed-precondition", effect.reason ?? "Achat refusé.");
  if (effect.kind === "missing") throw new HttpsError("not-found", "Aucune commande ne correspond à cet achat.");
  if (effect.consume) await consumeStored(hash, reading.productId, token);
  if (effect.eventId && (effect.kind === "grant" || effect.kind === "refund")) await refreshTeamProgress(effect.eventId);
  if (effect.email && effect.eventId && effect.payment) await sendReceipt(effect.eventId, effect.email, effect.payment, reading.obfuscatedProfileId);
  if (effect.kind === "grant") await audit(effect.eventId, callerUid, "play.granted");
  if (effect.kind === "refund") await audit(effect.eventId, callerUid, "play.refunded");
  return { status: effect.kind === "grant" || effect.kind === "duplicate" ? "succeeded" : effect.kind === "pending" ? "pending" : effect.kind === "refund" ? "refunded" : "canceled" };
}

async function consumeStored(hash: string, productId: string, token: string) {
  const gateway = playGateway();
  const ref = db.collection("playPurchases").doc(hash);
  try {
    const consumed = await gateway.consume(productId, token);
    if (!consumed) throw new Error("consume");
    await ref.set({ consumeState: "consumed", updatedAt: stamp() }, { merge: true });
    const paymentId = String((await ref.get()).data()?.paymentId ?? "");
    if (paymentId) await db.collection("payments").doc(paymentId).set({ consumeState: "consumed", updatedAt: stamp() }, { merge: true });
  } catch {
    await ref.set({ consumeState: "due", updatedAt: stamp() }, { merge: true });
    const paymentId = String((await ref.get()).data()?.paymentId ?? "");
    if (paymentId) await db.collection("payments").doc(paymentId).set({ consumeState: "due", updatedAt: stamp() }, { merge: true });
  }
}

const submitSchema = z.object({
  purchaseToken: z.string().trim().min(8).max(4096),
  productId: z.string().trim().min(3).max(40),
}).strict();

export const submitPlayPurchase = callable(async (request, uid) => {
  if (!purchaseOpen(uid)) {
    throw new HttpsError("permission-denied", "Les achats Google Play ne sont pas ouverts pour ce compte. Aucun droit n'est accordé.");
  }
  const input = parse(submitSchema, request.data);
  if (!isPlayProductId(input.productId)) throw new HttpsError("invalid-argument", "Produit Google Play inconnu.");
  const user = await adminAuth.getUser(uid);
  if (user.email && !user.emailVerified) {
    throw new HttpsError("failed-precondition", "Vérifie ton adresse e-mail avant cette action. Tu peux renvoyer le message depuis le profil, consulter l'aide et te déconnecter.");
  }
  return applyVerifiedPurchase(uid, input.purchaseToken, input.productId, null);
}, playRuntime);

const reconcileSchema = z.object({
  purchases: z.array(z.object({
    purchaseToken: z.string().trim().min(8).max(4096),
    productId: z.string().trim().min(3).max(40),
  })).max(8),
}).strict();

export const reconcilePlayPurchases = callable(async (request, uid) => {
  if (!purchaseOpen(uid)) return { results: [] };
  const input = parse(reconcileSchema, request.data);
  const results: Array<{ status: string }> = [];
  for (const purchase of input.purchases) {
    if (!isPlayProductId(purchase.productId)) {
      results.push({ status: "ignored" });
      continue;
    }
    try {
      const applied = await applyVerifiedPurchase(uid, purchase.purchaseToken, purchase.productId, null);
      results.push({ status: applied.status });
    } catch {
      results.push({ status: "unchanged" });
    }
  }
  await retryConsumptionFor(uid);
  return { results };
}, playRuntime);

async function retryConsumptionFor(uid: string | null) {
  const due = await db.collection("playPurchases").where("consumeState", "==", "due").limit(20).get();
  for (const doc of due.docs) {
    const data = doc.data();
    if (uid && data.organizerUid !== uid) continue;
    const token = String(data.purchaseToken ?? "");
    const productId = String(data.productId ?? "");
    if (!token || !productId) continue;
    await consumeStored(doc.id, productId, token);
  }
}

export const playConsumeWorker = onSchedule({
  schedule: "every 60 minutes",
  region: "europe-west1",
  timeZone: "Europe/Paris",
  memory: "256MiB",
  cpu: 0.167,
  maxInstances: 1,
  serviceAccount: playRuntimeAccount,
}, async () => {
  await retryConsumptionFor(null);
});

export const playDeveloperNotification = onRequest({
  region: "europe-west1",
  cors: false,
  memory: "256MiB",
  cpu: 0.167,
  maxInstances: 1,
  serviceAccount: playRuntimeAccount,
  invoker: playRuntimeAccount,
}, async (request, response) => {
  if (request.method !== "POST") {
    response.status(405).send("Méthode refusée");
    return;
  }
  const audience = process.env.PLAY_RTDN_AUDIENCE || "";
  const email = process.env.PLAY_RTDN_PUSH_EMAIL || playRuntimeAccount;
  const bearer = String(request.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!audience || !email || !bearer) {
    response.status(401).send("Authentification refusée");
    return;
  }
  try {
    const ticket = await new OAuth2Client().verifyIdToken({ idToken: bearer, audience });
    const claims = ticket.getPayload();
    if (!claims || !pushClaimsOk(claims, { audience, email, nowSec: Math.floor(Date.now() / 1000) })) {
      response.status(401).send("Authentification refusée");
      return;
    }
  } catch {
    response.status(401).send("Authentification refusée");
    return;
  }
  const envelope = readPubSubEnvelope(request.body);
  if (!envelope) {
    response.status(400).send("Avis illisible");
    return;
  }
  const notice = readDeveloperNotification(envelope.payload, envelope.messageId);
  if (notice.kind === "ignore") {
    response.status(200).send("ignoré");
    return;
  }
  try {
    await applyVerifiedPurchase(await organizerForNotice(notice.purchaseToken), notice.purchaseToken, notice.productId || null, envelope.messageId);
    response.status(200).send("ok");
  } catch (error) {
    const code = error instanceof HttpsError ? error.code : "internal";
    if (code === "not-found" || code === "failed-precondition" || code === "permission-denied") {
      response.status(200).send("non repris");
      return;
    }
    response.status(503).send("Relecture impossible");
  }
});

async function organizerForNotice(token: string): Promise<string> {
  const reading = await playGateway().read(token);
  if (!reading) throw new HttpsError("unavailable", "Lecture impossible.");
  const payment = await db.collection("payments").doc(reading.obfuscatedProfileId).get();
  return String(payment.data()?.organizerUid ?? "");
}
