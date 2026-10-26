const CLOSED = new Set(["cancelled", "archived", "revealed"]);

export function canRemindView(input: { status: string; discovered: boolean; declined: boolean; startsAt: number | null; now: number }): boolean {
  if (input.status !== "drawn") return false;
  if (CLOSED.has(input.status) || input.discovered || input.declined) return false;
  if (input.startsAt !== null && input.startsAt <= input.now) return false;
  return true;
}

export function canRemindWishes(input: { status: string; filled: boolean; declined: boolean; startsAt: number | null; now: number }): boolean {
  if (input.status !== "registration_open" && input.status !== "ready") return false;
  if (input.filled || input.declined) return false;
  if (input.startsAt !== null && input.startsAt <= input.now) return false;
  return true;
}
