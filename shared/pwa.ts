export const PWA_CHECK_INTERVAL_MS = 60_000;
export const PWA_LATER_SNOOZE_MS = 6 * 60 * 60 * 1000;

export interface UpdateOfferInput {
  now: number;
  snoozeUntil: number | null;
  waitingWorker: boolean;
  remoteVersion: string | null;
  acknowledgedVersion: string | null;
  checkFailed: boolean;
  sensitiveLocked: boolean;
  dialogAlreadyOpen: boolean;
}

/** N'annonce une mise à jour que si un nouveau worker attend vraiment. */
export function shouldOfferUpdate(input: UpdateOfferInput): boolean {
  if (input.checkFailed || input.sensitiveLocked || input.dialogAlreadyOpen) return false;
  if (!input.waitingWorker || !input.remoteVersion) return false;
  if (input.remoteVersion === input.acknowledgedVersion) return false;
  if (input.snoozeUntil !== null && input.now < input.snoozeUntil) return false;
  return true;
}

export function shouldPollVersion(visible: boolean, lastCheckAt: number, now: number, inFlight: boolean): boolean {
  if (!visible || inFlight) return false;
  return now - lastCheckAt >= PWA_CHECK_INTERVAL_MS;
}
