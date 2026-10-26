export const EVENT_STATUSES = [
  "draft",
  "registration_open",
  "ready",
  "drawn",
  "revealed",
  "archived",
  "cancelled",
] as const;

export type EventStatus = (typeof EVENT_STATUSES)[number];

export const PRIVACY_MODES = ["classic", "public", "double_blind"] as const;
export type PrivacyMode = (typeof PRIVACY_MODES)[number];

export const CONTEXTS = ["family", "friends", "organization"] as const;
export type ContextKind = (typeof CONTEXTS)[number];

export const OCCASIONS = ["christmas", "annual", "other"] as const;
export type Occasion = (typeof OCCASIONS)[number];

export const JOIN_POLICIES = ["approval", "open", "closed"] as const;
export type JoinPolicy = (typeof JOIN_POLICIES)[number];

export const MEMBER_STATUSES = ["draft", "invited", "pending", "joined", "declined"] as const;
export type MemberStatus = (typeof MEMBER_STATUSES)[number];

export type Exclusion =
  | { kind: "directional"; fromId: string; toId: string }
  | { kind: "reciprocal"; aId: string; bId: string }
  | { kind: "group"; memberIds: string[] }
  | { kind: "history"; fromId: string; toId: string };

export interface Budget {
  min: number;
  max: number;
  currency: string;
  handmade: boolean;
  secondHand: boolean;
}

export interface Assignment {
  giverId: string;
  recipientId: string;
  slot: number;
}

export const STATUS_LABELS: Record<EventStatus, string> = {
  draft: "Brouillon",
  registration_open: "Inscriptions ouvertes",
  ready: "Prêt",
  drawn: "Tirage lancé",
  revealed: "Résultats révélés",
  archived: "Archivé",
  cancelled: "Annulé",
};

export const PRIVACY_LABELS: Record<PrivacyMode, string> = {
  classic: "Secret classique",
  public: "Attributions publiques",
  double_blind: "Double mystère",
};

export const CONTEXT_LABELS: Record<ContextKind, string> = {
  family: "Famille",
  friends: "Amis",
  organization: "Entreprise ou association",
};

export const OCCASION_LABELS: Record<Occasion, string> = {
  christmas: "Noël",
  annual: "Échange annuel",
  other: "Autre occasion",
};

export const JOIN_LABELS: Record<JoinPolicy, string> = {
  approval: "Validation par l'organisateur",
  open: "Entrée libre",
  closed: "Inscriptions closes",
};

/** Transitions qu'un simple changement de statut peut faire. Tirage et révélation ont leurs propres opérations. */
const EDGES: Record<EventStatus, EventStatus[]> = {
  draft: ["registration_open", "ready", "cancelled"],
  registration_open: ["draft", "ready", "cancelled"],
  ready: ["registration_open", "draft", "cancelled"],
  drawn: ["cancelled", "archived"],
  revealed: ["archived"],
  archived: [],
  cancelled: [],
};

export function canTransition(from: EventStatus, to: EventStatus): boolean {
  return EDGES[from].includes(to);
}

export function canLaunchDraw(status: EventStatus): boolean {
  return status === "draft" || status === "registration_open" || status === "ready";
}

export function canEditRoster(status: EventStatus): boolean {
  return status === "draft" || status === "registration_open" || status === "ready";
}

export function canReveal(status: EventStatus): boolean {
  return status === "drawn";
}

export type LaunchDecision = "replay" | "already-drawn" | "busy" | "proceed" | "invalid-status";

export interface LaunchState {
  status: EventStatus;
  idempotencyKey: string | null;
  lockUntil: number | null;
}

export function decideLaunch(state: LaunchState, key: string, now: number): LaunchDecision {
  if (state.status === "drawn" || state.status === "revealed" || state.status === "archived") {
    return state.idempotencyKey === key ? "replay" : "already-drawn";
  }
  if (!canLaunchDraw(state.status)) return "invalid-status";
  if (state.lockUntil !== null && state.lockUntil > now) return "busy";
  return "proceed";
}
