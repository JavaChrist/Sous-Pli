import { zonedLocalToUtc } from "./time";

export const retentionRules = {
  accessMonths: 12,
  warningDays: 30,
  invitationLinkDays: 30,
  invitationPurgeDaysAfterExpiry: 60,
  draftWarnMonths: 5,
  draftDeleteMonths: 6,
  inactiveAccountMonths: 24,
  inactiveGraceDays: 30,
  securityLogMonths: 6,
  mailMetadataDays: 90,
  accountingYears: 10,
  withdrawalDays: 14,
} as const;

export const ACTIVE_EVENT_STATUSES = ["draft", "registration_open", "ready", "drawn", "revealed"] as const;

const DAY_MS = 24 * 60 * 60 * 1000;

export function addCalendarMonths(isoDate: string, months: number): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) throw new Error("Date invalide.");
  const [year, month, day] = isoDate.split("-").map(Number);
  const cursor = new Date(Date.UTC(year, month - 1 + months, 1));
  const lastDay = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 0)).getUTCDate();
  const clamped = Math.min(day, lastDay);
  return new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth(), clamped)).toISOString().slice(0, 10);
}

export function addMonths(instant: Date, months: number): Date {
  const next = new Date(instant.getTime());
  next.setUTCMonth(next.getUTCMonth() + months);
  return next;
}

/** Fin d'accès : 23 h 59, fuseau de l'événement, douze mois après sa date. */
export function accessEndInstant(localDate: string, timeZone: string): Date {
  return zonedLocalToUtc(addCalendarMonths(localDate, retentionRules.accessMonths), "23:59", timeZone);
}

export function nextAccessUntil(input: {
  currentUntil: Date | null;
  locked: boolean;
  nextLocalDate: string;
  timeZone: string;
}): { until: Date; refused: string | null } {
  const nextEnd = accessEndInstant(input.nextLocalDate, input.timeZone);
  if (!input.currentUntil) return { until: nextEnd, refused: null };
  if (nextEnd.getTime() > input.currentUntil.getTime()) {
    return {
      until: input.currentUntil,
      refused: input.locked
        ? "La fin d'accès a été fixée à la commande. Un report ne peut pas la repousser."
        : "Cette date dépasse la fin d'accès fixée à la création. Dupliquez l'événement pour une date plus tardive. La duplication ne transfère pas une offre payée.",
    };
  }
  return { until: input.locked ? input.currentUntil : nextEnd, refused: null };
}

export function retentionPhase(accessUntil: Date, now: Date): "open" | "warning" | "due" {
  const warnAt = accessUntil.getTime() - retentionRules.warningDays * DAY_MS;
  if (now.getTime() >= accessUntil.getTime()) return "due";
  if (now.getTime() >= warnAt) return "warning";
  return "open";
}

export function draftPhase(updatedAt: Date, now: Date): "keep" | "warn" | "delete" {
  if (now.getTime() >= addMonths(updatedAt, retentionRules.draftDeleteMonths).getTime()) return "delete";
  if (now.getTime() >= addMonths(updatedAt, retentionRules.draftWarnMonths).getTime()) return "warn";
  return "keep";
}

export function accountPhase(input: { lastSeenAt: Date; warnedAt: Date | null; now: Date }): "keep" | "warn" | "delete" {
  const inactiveAt = addMonths(input.lastSeenAt, retentionRules.inactiveAccountMonths);
  if (input.now.getTime() < inactiveAt.getTime()) return "keep";
  if (!input.warnedAt) return "warn";
  if (input.lastSeenAt.getTime() > input.warnedAt.getTime()) return "keep";
  if (input.now.getTime() >= input.warnedAt.getTime() + retentionRules.inactiveGraceDays * DAY_MS) return "delete";
  return "keep";
}

export function invitationPurgeAt(expiresAtMs: number): number {
  return expiresAtMs + retentionRules.invitationPurgeDaysAfterExpiry * DAY_MS;
}

export function securityLogDue(at: Date, now: Date): boolean {
  return now.getTime() >= addMonths(at, retentionRules.securityLogMonths).getTime();
}

export function mailMetadataDue(sentAt: Date, now: Date): boolean {
  return now.getTime() >= sentAt.getTime() + retentionRules.mailMetadataDays * DAY_MS;
}

export function organizerCanCloseAccount(statuses: string[]): { ok: true } | { ok: false; message: string } {
  const blocking = statuses.filter((status) => (ACTIVE_EVENT_STATUSES as readonly string[]).includes(status));
  if (!blocking.length) return { ok: true };
  return {
    ok: false,
    message:
      "Vous organisez encore un échange en cours. Annulez-le ou archivez-le avant de supprimer le compte. L'échange des autres participants n'est pas supprimé avec votre compte.",
  };
}
