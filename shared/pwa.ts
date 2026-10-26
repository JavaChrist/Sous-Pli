export const PWA_CHECK_INTERVAL_MS = 60_000;
export const PWA_LATER_SNOOZE_MS = 6 * 60 * 60 * 1000;

export interface UpdateOfferInput {
  now: number;
  snoozeUntil: number | null;
  pageVersion: string;
  remoteVersion: string | null;
  acknowledgedVersion: string | null;
  checkFailed: boolean;
  sensitiveLocked: boolean;
  dialogAlreadyOpen: boolean;
}

/** Vrai quand le déploiement servi n'est plus celui de la page ouverte. */
export function isNewerDeployment(pageVersion: string, remoteVersion: string | null): boolean {
  if (!remoteVersion || remoteVersion === "dev" || pageVersion === "dev") return false;
  return remoteVersion !== pageVersion;
}

/** Annonce une mise à jour après un nouveau commit déployé, jamais pendant une saisie. */
export function shouldOfferUpdate(input: UpdateOfferInput): boolean {
  if (input.checkFailed || input.sensitiveLocked || input.dialogAlreadyOpen) return false;
  if (!isNewerDeployment(input.pageVersion, input.remoteVersion)) return false;
  if (input.remoteVersion === input.acknowledgedVersion) return false;
  if (input.snoozeUntil !== null && input.now < input.snoozeUntil) return false;
  return true;
}

export function shouldPollVersion(visible: boolean, lastCheckAt: number, now: number, inFlight: boolean): boolean {
  if (!visible || inFlight) return false;
  return now - lastCheckAt >= PWA_CHECK_INTERVAL_MS;
}
