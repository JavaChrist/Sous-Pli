import type { DocumentData } from "firebase-admin/firestore";
import { emailOfferRights, readCommercial } from "../../shared/billing";
import type { EmailTheme } from "../../shared/email/templates";
import { defaultTheme } from "../../shared/email/templates";
import type { TemplateVars } from "../../shared/email/render";
import { formatInZone } from "../../shared/time";
import { db } from "./admin";
import { asDate } from "./views";

export async function loadTheme(eventId: string, data: DocumentData): Promise<EmailTheme> {
  const base = defaultTheme(data.context ?? "family", data.occasion ?? "other");
  const snap = await db.collection("events").doc(eventId).collection("emailTheme").doc("current").get();
  const stored = (snap.data() ?? {}) as Partial<EmailTheme>;
  const commercial = readCommercial(data);
  const rights = emailOfferRights(commercial.offerId, commercial.status);
  return {
    ...base,
    ...stored,
    identity: "event",
    context: data.context ?? base.context,
    occasion: data.occasion ?? base.occasion,
    logoUrl: rights.logo ? String(stored.logoUrl ?? "") : "",
    subjectOverrides: rights.subjects ? stored.subjectOverrides ?? {} : {},
  };
}

export function templateVars(data: DocumentData, prenom: string, organizer: string, lien: string): TemplateVars {
  const starts = asDate(data.startsAt) ?? new Date();
  const zone = String(data.timeZone ?? "Europe/Paris");
  const formatted = formatInZone(starts, zone);
  const budget = data.budget as { min?: number; max?: number; currency?: string } | null;
  return {
    prenom,
    evenement: String(data.name ?? "Échange"),
    organisateur: organizer,
    structure: String(data.organizationName || data.name || "le groupe"),
    date: formatted.date,
    heure: formatted.time,
    budget: budget ? `${budget.min} à ${budget.max}` : "",
    devise: budget?.currency || "EUR",
    lieu: String(data.place ?? ""),
    regles: String(data.rulesText ?? ""),
    lien,
    signature: String(data.organizationName || organizer),
    equipe: String(data.teamName ?? ""),
  };
}
