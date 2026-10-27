import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { MEMBER_STATUS_LABELS, STATUS_LABELS, type EventStatus, type MemberStatus } from "@shared/domain";

export function asDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === "string" || typeof value === "number") {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  if (typeof value === "object" && value && "toDate" in value && typeof (value as { toDate: () => Date }).toDate === "function") {
    return (value as { toDate: () => Date }).toDate();
  }
  return null;
}

export function formatWhen(value: unknown, pattern = "EEEE d MMMM yyyy 'à' HH:mm"): string {
  const date = asDate(value);
  if (!date) return "Date non précisée";
  return format(date, pattern, { locale: fr });
}

export function statusLabel(status: string): string {
  return STATUS_LABELS[status as EventStatus] ?? status;
}

export function memberStatusLabel(status: string): string {
  return MEMBER_STATUS_LABELS[status as MemberStatus] ?? status;
}
