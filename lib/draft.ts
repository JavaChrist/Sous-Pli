const KEY = "souspli.draft.event.v1";

export interface EventDraft {
  name: string;
  occasion: "christmas" | "annual" | "other";
  context: "family" | "friends" | "organization";
  localDate: string;
  localTime: string;
  timeZone: string;
  place: string;
  description: string;
  rulesText: string;
  budgetEnabled: boolean;
  budgetMin: string;
  budgetMax: string;
  handmade: boolean;
  secondHand: boolean;
  privacyMode: "classic" | "public" | "double_blind";
  giftsPerPerson: number;
  avoidReciprocal: boolean;
  organizerParticipates: boolean;
  revealLocalDate: string;
  revealLocalTime: string;
  joinPolicy: "approval" | "open" | "closed";
  offerId: "family" | "association" | "business" | "business_plus" | "quote";
  organizationName: string;
  teamName: string;
  members: Array<{ memberId?: string; displayName: string; email: string; groupLabel: string; managedByMemberId?: string | null }>;
}

export const emptyDraft = (): EventDraft => ({
  name: "",
  occasion: "christmas",
  context: "family",
  localDate: "",
  localTime: "18:30",
  timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || "Europe/Paris",
  place: "",
  description: "",
  rulesText: "",
  budgetEnabled: false,
  budgetMin: "15",
  budgetMax: "30",
  handmade: false,
  secondHand: false,
  privacyMode: "classic",
  giftsPerPerson: 1,
  avoidReciprocal: true,
  organizerParticipates: true,
  revealLocalDate: "",
  revealLocalTime: "18:30",
  joinPolicy: "approval",
  offerId: "family",
  organizationName: "",
  teamName: "",
  members: [],
});

export function loadDraft(): EventDraft | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(KEY);
  if (!raw) return null;
  try {
    return { ...emptyDraft(), ...JSON.parse(raw) };
  } catch {
    return null;
  }
}

export function saveDraft(draft: EventDraft) {
  localStorage.setItem(KEY, JSON.stringify(draft));
}

export function clearDraft() {
  localStorage.removeItem(KEY);
}
