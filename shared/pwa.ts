export const PWA_CHECK_INTERVAL_MS = 60_000;
export const PWA_LATER_SNOOZE_MS = 6 * 60 * 60 * 1000;
export const INSTALL_MIN_VISITS = 3;
export const INSTALL_SNOOZE_MS = 90 * 24 * 60 * 60 * 1000;

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

export interface InstallVisitInput {
  visits: number;
  lastVisitDay: string | null;
  today: string;
}

/** Un jour d'usage compte une fois. Un ancien compteur sans date repart à un, pour ne pas rouvrir la fenêtre tout de suite. */
export function nextInstallVisit(input: InstallVisitInput): { visits: number; lastVisitDay: string } {
  if (!input.lastVisitDay) return { visits: 1, lastVisitDay: input.today };
  if (input.lastVisitDay === input.today) return { visits: input.visits, lastVisitDay: input.today };
  return { visits: input.visits + 1, lastVisitDay: input.today };
}

export function shouldOfferInstall(input: {
  now: number;
  dismissedUntil: number | null;
  visits: number;
  standalone: boolean;
  alreadyShownThisSession: boolean;
}): boolean {
  if (input.standalone || input.alreadyShownThisSession) return false;
  if (input.dismissedUntil !== null && input.now < input.dismissedUntil) return false;
  return input.visits >= INSTALL_MIN_VISITS;
}

export function shouldPollVersion(visible: boolean, lastCheckAt: number, now: number, inFlight: boolean): boolean {
  if (!visible || inFlight) return false;
  return now - lastCheckAt >= PWA_CHECK_INTERVAL_MS;
}
