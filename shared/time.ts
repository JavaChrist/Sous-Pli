import { fromZonedTime } from "date-fns-tz";

export function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat("fr-FR", { timeZone });
    return true;
  } catch {
    return false;
  }
}

/** Convertit une date et une heure civiles dans un fuseau IANA vers un instant UTC. */
export function zonedLocalToUtc(date: string, time: string, timeZone: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) {
    throw new Error("Date ou heure invalide.");
  }
  if (!isValidTimeZone(timeZone)) throw new Error("Fuseau horaire invalide.");
  const instant = fromZonedTime(`${date}T${time}:00`, timeZone);
  if (Number.isNaN(instant.getTime())) throw new Error("Cet horaire n'existe pas dans ce fuseau.");
  return instant;
}

export function canRevealNow(now: Date, revealAt: Date): boolean {
  return now.getTime() >= revealAt.getTime();
}

export function formatInZone(instant: Date, timeZone: string): { date: string; time: string } {
  const date = new Intl.DateTimeFormat("fr-FR", {
    timeZone,
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(instant);
  const time = new Intl.DateTimeFormat("fr-FR", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
  }).format(instant);
  return { date, time };
}
