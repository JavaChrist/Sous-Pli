import { solveDraw } from "./draw/engine";
import { emailOfferRights, hasPaidBusinessPlus, launchBlock, readCommercial } from "./billing";

/** Durée unique du droit d'examen. Elle n'est pas choisie par l'appelant. */
export const PLAY_REVIEW_GRANT_MS = 90 * 24 * 60 * 60 * 1000;

export const PLAY_REVIEW_PURPOSE = "play-review" as const;

export const PLAY_REVIEW_EVENT_NAMES = [
  "Noël de démonstration — Organisation",
  "Noël de démonstration — Tirage effectué",
] as const;

export type PlayReviewEventName = (typeof PLAY_REVIEW_EVENT_NAMES)[number];

const ORGANISATION: PlayReviewEventName = "Noël de démonstration — Organisation";
const DRAWN: PlayReviewEventName = "Noël de démonstration — Tirage effectué";

export interface PlayReviewGrant {
  purpose: typeof PLAY_REVIEW_PURPOSE;
  offerId: "business_plus";
  beneficiaryUid: string;
  expiresAtMs: number;
  revokedAtMs: number | null;
}

export interface DemoMember {
  id: string;
  displayName: string;
  role: "organizer" | "participant";
  status: "joined" | "draft";
  groupLabel: string;
  email: "";
}

export interface DemoWish {
  memberId: string;
  items: Array<{ text: string; url: ""; image: "" }>;
}

export interface DemoMessage {
  id: string;
  body: string;
  fromLabel: "Votre correspondant";
  direction: "in";
}

export interface DemoEventPlan {
  key: "organisation" | "draw";
  name: PlayReviewEventName;
  status: "ready" | "drawn";
  offerId: "business_plus";
  commercialStatus: "unpaid";
  paidOfferId: null;
  paidAmountCents: 0;
  commercialReference: null;
  context: "organization";
  privacyMode: "classic";
  organizerParticipates: true;
  giftsPerPerson: 1;
  avoidReciprocal: true;
  localDate: "2026-12-24";
  localTime: "19:00";
  timeZone: "Europe/Paris";
  place: string;
  organizationName: string;
  description: string;
  members: DemoMember[];
  wishes: DemoWish[];
  coOrganizers: Array<{ id: string; displayName: string; email: "" }>;
  teams: Array<{ label: string; members: number; discovered: number }>;
  assignments: Array<{ giverId: string; recipientId: string; slot: number; threadId: string }>;
  messages: DemoMessage[];
  demoGrant: PlayReviewGrant;
  outboundEmails: [];
  payments: [];
}

export type PlayReviewPlan =
  | { ok: true; events: [DemoEventPlan, DemoEventPlan] }
  | { ok: false; reason: string };

function grant(beneficiaryUid: string, nowMs: number): PlayReviewGrant {
  return {
    purpose: PLAY_REVIEW_PURPOSE,
    offerId: "business_plus",
    beneficiaryUid,
    expiresAtMs: nowMs + PLAY_REVIEW_GRANT_MS,
    revokedAtMs: null,
  };
}

function readGrant(data: { demoGrant?: unknown; name?: unknown; offerId?: unknown; organizerUid?: unknown }): PlayReviewGrant | null {
  const raw = data.demoGrant;
  if (!raw || typeof raw !== "object") return null;
  const value = raw as Partial<PlayReviewGrant>;
  if (value.purpose !== PLAY_REVIEW_PURPOSE || value.offerId !== "business_plus") return null;
  if (typeof value.beneficiaryUid !== "string" || !value.beneficiaryUid || /\s/.test(value.beneficiaryUid)) return null;
  if (typeof value.expiresAtMs !== "number" || !Number.isFinite(value.expiresAtMs)) return null;
  if (value.revokedAtMs !== null && typeof value.revokedAtMs !== "number") return null;
  if (!PLAY_REVIEW_EVENT_NAMES.includes(String(data.name) as PlayReviewEventName)) return null;
  if (data.offerId !== "business_plus") return null;
  if (data.organizerUid !== value.beneficiaryUid) return null;
  return {
    purpose: PLAY_REVIEW_PURPOSE,
    offerId: "business_plus",
    beneficiaryUid: value.beneficiaryUid,
    expiresAtMs: value.expiresAtMs,
    revokedAtMs: value.revokedAtMs ?? null,
  };
}

function grantLive(data: Parameters<typeof readGrant>[0], nowMs: number): PlayReviewGrant | null {
  const parsed = readGrant(data);
  if (!parsed || parsed.revokedAtMs !== null || parsed.expiresAtMs <= nowMs) return null;
  return parsed;
}

/** Droit actif seulement pour le compte désigné, sur l'un des deux événements, avant échéance et révocation. */
export function playReviewAllows(data: Parameters<typeof readGrant>[0], callerUid: string, nowMs: number): boolean {
  const parsed = grantLive(data, nowMs);
  return Boolean(parsed && callerUid && parsed.beneficiaryUid === callerUid);
}

export function playReviewFeatures(data: Parameters<typeof readGrant>[0], nowMs: number): { teamProgress: boolean; mail: boolean } {
  const parsed = grantLive(data, nowMs);
  return { teamProgress: Boolean(parsed), mail: Boolean(parsed) };
}

export function businessPlusFeatures(data: Parameters<typeof readCommercial>[0] & Parameters<typeof readGrant>[0], callerUid: string, nowMs: number): boolean {
  return hasPaidBusinessPlus(data) || playReviewAllows(data, callerUid, nowMs);
}

export function mailFeatureRights(data: Parameters<typeof readCommercial>[0] & Parameters<typeof readGrant>[0], callerUid: string, nowMs: number): { logo: boolean; subjects: boolean } {
  const commercial = readCommercial(data);
  const paid = emailOfferRights(commercial.offerId, commercial.status);
  if (paid.logo || paid.subjects) return paid;
  if (playReviewAllows(data, callerUid, nowMs)) return { logo: true, subjects: true };
  return paid;
}

/** Le blocage commercial reste prioritaire quand l'offre est déjà payée. Le droit d'examen ne l'ouvre que pour son bénéficiaire. */
export function drawAllowed(data: Parameters<typeof readCommercial>[0] & Parameters<typeof readGrant>[0], callerUid: string, nowMs: number): string | null {
  const blocked = launchBlock(readCommercial(data));
  if (!blocked) return null;
  if (playReviewAllows(data, callerUid, nowMs)) return null;
  return blocked;
}

/** Empêche une commande sur l'événement désigné tant que le droit vit. Les autres événements suivent le catalogue. */
export function commercialOrderRefusal(data: Parameters<typeof readGrant>[0], nowMs: number): string | null {
  if (!grantLive(data, nowMs)) return null;
  return "Cet événement de démonstration n'ouvre pas de commande.";
}

const PEOPLE: DemoMember[] = [
  { id: "m-examinateur", displayName: "Examinateur", role: "organizer", status: "joined", groupLabel: "Direction", email: "" },
  { id: "m-lea", displayName: "Léa", role: "participant", status: "draft", groupLabel: "Atelier", email: "" },
  { id: "m-noah", displayName: "Noah", role: "participant", status: "draft", groupLabel: "Atelier", email: "" },
  { id: "m-ines", displayName: "Inès", role: "participant", status: "draft", groupLabel: "Accueil", email: "" },
];

const WISHES: DemoWish[] = [
  { memberId: "m-lea", items: [{ text: "Un livre de contes illustrés", url: "", image: "" }] },
  { memberId: "m-noah", items: [{ text: "Des crayons de couleur", url: "", image: "" }] },
  { memberId: "m-ines", items: [{ text: "Une écharpe chaude", url: "", image: "" }] },
];

const CO_ORGANIZERS = [
  { id: "demo-co-camille", displayName: "Camille (fictif)", email: "" as const },
  { id: "demo-co-marc", displayName: "Marc (fictif)", email: "" as const },
];

function teamsOf(members: DemoMember[]): DemoEventPlan["teams"] {
  const groups = new Map<string, number>();
  for (const member of members) groups.set(member.groupLabel, (groups.get(member.groupLabel) ?? 0) + 1);
  return [...groups.entries()].map(([label, members]) => ({ label, members, discovered: 0 }));
}

function baseEvent(name: PlayReviewEventName, key: DemoEventPlan["key"], status: DemoEventPlan["status"], beneficiaryUid: string, nowMs: number): DemoEventPlan {
  return {
    key,
    name,
    status,
    offerId: "business_plus",
    commercialStatus: "unpaid",
    paidOfferId: null,
    paidAmountCents: 0,
    commercialReference: null,
    context: "organization",
    privacyMode: "classic",
    organizerParticipates: true,
    giftsPerPerson: 1,
    avoidReciprocal: true,
    localDate: "2026-12-24",
    localTime: "19:00",
    timeZone: "Europe/Paris",
    place: "Salle fictive des lutins",
    organizationName: "Atelier des lutins",
    description: "Événement fictif réservé à l'examen Google Play. Aucune invitation n'est envoyée.",
    members: PEOPLE.map((member) => ({ ...member })),
    wishes: WISHES.map((wish) => ({ ...wish, items: wish.items.map((item) => ({ ...item })) })),
    coOrganizers: key === "organisation" ? CO_ORGANIZERS.map((row) => ({ ...row })) : [],
    teams: teamsOf(PEOPLE),
    assignments: [],
    messages: [],
    demoGrant: grant(beneficiaryUid, nowMs),
    outboundEmails: [],
    payments: [],
  };
}

/** Prépare les deux événements. N'écrit rien et ne contient aucune adresse. */
export function planPlayReviewEvents(beneficiaryUid: string, nowMs: number): PlayReviewPlan {
  const uid = beneficiaryUid.trim();
  if (!uid || /\s/.test(beneficiaryUid)) {
    return { ok: false, reason: "Le compte examinateur est absent. Aucun droit n'est préparé." };
  }
  const organisation = baseEvent(ORGANISATION, "organisation", "ready", uid, nowMs);
  const drawn = baseEvent(DRAWN, "draw", "drawn", uid, nowMs);
  const solved = solveDraw({
    memberIds: drawn.members.map((member) => member.id),
    giftsPerPerson: 1,
    exclusions: [],
    avoidReciprocal: true,
    rng: () => 0.42,
  });
  if (!solved.ok) return { ok: false, reason: "Le tirage fictif est impossible. Aucun événement n'est préparé." };
  drawn.assignments = solved.assignments.map((edge, index) => ({
    ...edge,
    threadId: `demo-thread-${index + 1}`,
  }));
  const own = drawn.assignments.find((edge) => edge.giverId === "m-examinateur");
  if (!own) return { ok: false, reason: "L'examinateur n'a pas de destinataire. Aucun événement n'est préparé." };
  drawn.messages = [{
    id: "demo-message-1",
    body: "Le paquet fictif est prêt. Ce message ne part vers personne.",
    fromLabel: "Votre correspondant",
    direction: "in",
  }];
  return { ok: true, events: [organisation, drawn] };
}
