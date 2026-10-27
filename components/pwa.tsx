"use client";

import { INSTALL_SNOOZE_MS, PWA_CHECK_INTERVAL_MS, PWA_LATER_SNOOZE_MS, nextInstallVisit, shouldOfferInstall, shouldOfferUpdate, shouldPollVersion } from "@shared/pwa";
import { useEffect, useRef, useState } from "react";
import { useConfirm, useSensitive } from "./providers";
import { Button } from "./ui/button";
import { Modal } from "./ui/modal";

const SNOOZE_KEY = "souspli.pwa.snoozeUntil";
const ACK_KEY = "souspli.pwa.lastAcknowledgedAppVersion";
const SESSION_KEY = "souspli.pwa.dismissedSession";
const ACCEPT_KEY = "souspli.pwa.updateAccepted";

export function UpdateManager({ pageVersion }: { pageVersion: string }) {
  const { locked } = useSensitive();
  const confirm = useConfirm();
  const [open, setOpen] = useState(false);
  const [remote, setRemote] = useState<string | null>(null);
  const [checkFailed, setCheckFailed] = useState(false);
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null);
  const [busy, setBusy] = useState(false);
  const registrationRef = useRef<ServiceWorkerRegistration | null>(null);

  useEffect(() => {
    if (pageVersion === "dev" || typeof window === "undefined") return;
    let timer = 0;
    let lastCheck = 0;
    let inFlight = false;
    let cancelled = false;

    const check = async () => {
      const visible = document.visibilityState === "visible";
      if (!visible) return;
      if (!shouldPollVersion(visible, lastCheck, Date.now(), inFlight) && lastCheck !== 0) return;
      inFlight = true;
      lastCheck = Date.now();
      try {
        const response = await fetch("/api/version", { cache: "no-store" });
        if (!response.ok) throw new Error("version");
        const payload = (await response.json()) as { version?: string };
        if (cancelled) return;
        setRemote(payload.version ?? null);
        setCheckFailed(false);
        if (payload.version && payload.version !== pageVersion) await registrationRef.current?.update();
      } catch {
        if (!cancelled) {
          setRemote(null);
          setCheckFailed(true);
        }
      } finally {
        inFlight = false;
      }
    };

    const onReturn = () => {
      lastCheck = 0;
      void check();
    };
    timer = window.setInterval(() => void check(), PWA_CHECK_INTERVAL_MS);
    document.addEventListener("visibilitychange", onReturn);
    window.addEventListener("focus", onReturn);
    window.addEventListener("pageshow", onReturn);
    void check();
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onReturn);
      window.removeEventListener("focus", onReturn);
      window.removeEventListener("pageshow", onReturn);
    };
  }, [pageVersion]);

  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
    const enabled = process.env.NODE_ENV === "production" || process.env.NEXT_PUBLIC_ENABLE_SW === "true";
    if (!enabled) return;
    const hadController = Boolean(navigator.serviceWorker.controller);

    const onControllerChange = () => {
      if (!hadController) return;
      if (sessionStorage.getItem(ACCEPT_KEY) !== "1") return;
      if (sessionStorage.getItem("souspli.pwa.reloaded") === "1") return;
      sessionStorage.setItem("souspli.pwa.reloaded", "1");
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);

    const track = () => {
      const worker = registrationRef.current?.waiting;
      if (worker) setWaiting(worker);
    };
    void navigator.serviceWorker.register("/sw.js").then((next) => {
      registrationRef.current = next;
      track();
      next.addEventListener("updatefound", () => {
        const installing = next.installing;
        installing?.addEventListener("statechange", () => {
          if (installing.state === "installed" && navigator.serviceWorker.controller) track();
          if (installing.state === "installed" && !navigator.serviceWorker.controller) installing.postMessage({ type: "SKIP_WAITING" });
        });
      });
    });
    return () => navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
  }, []);

  useEffect(() => {
    const snooze = Number(localStorage.getItem(SNOOZE_KEY) || 0) || null;
    const offer = shouldOfferUpdate({
      now: Date.now(),
      snoozeUntil: snooze,
      pageVersion,
      remoteVersion: remote,
      acknowledgedVersion: localStorage.getItem(ACK_KEY),
      checkFailed,
      sensitiveLocked: locked,
      dialogAlreadyOpen: Boolean(document.querySelector("[role='dialog']")),
    });
    if (offer && sessionStorage.getItem(SESSION_KEY) !== "1") setOpen(true);
  }, [pageVersion, remote, locked, checkFailed]);

  async function updateNow() {
    if (locked || !remote || remote === pageVersion) return;
    const dirty = document.querySelector("form[data-dirty='true']");
    if (dirty) {
      const accepted = await confirm({
        title: "Mettre à jour maintenant ?",
        description: "Le brouillon local est conservé. Une saisie non enregistrée sur le serveur peut être perdue.",
        confirmLabel: "Mettre à jour",
      });
      if (!accepted) return;
    }
    setBusy(true);
    localStorage.setItem(ACK_KEY, remote);
    sessionStorage.setItem(ACCEPT_KEY, "1");
    if (waiting) {
      waiting.postMessage({ type: "SKIP_WAITING" });
      window.setTimeout(() => window.location.reload(), 1500);
      return;
    }
    window.location.reload();
  }

  return (
    <Modal
      open={open}
      busy={busy}
      onOpenChange={setOpen}
      title="Une nouvelle version est disponible"
      description="Vous pouvez l'appliquer maintenant. Rien n'est rechargé pendant une saisie ou un tirage."
    >
      <div className="flex flex-wrap justify-end gap-2">
        <Button
          variant="secondary"
          onClick={() => {
            localStorage.setItem(SNOOZE_KEY, String(Date.now() + PWA_LATER_SNOOZE_MS));
            sessionStorage.setItem(SESSION_KEY, "1");
            setOpen(false);
          }}
        >
          Plus tard
        </Button>
        <Button busy={busy} onClick={() => void updateNow()}>
          Mettre à jour
        </Button>
      </div>
    </Modal>
  );
}

const INSTALL_DISMISS_KEY = "souspli.pwa.installDismissed";
const INSTALL_VISITS_KEY = "souspli.pwa.visits";
const INSTALL_DAY_KEY = "souspli.pwa.installDay";
const INSTALL_SESSION_KEY = "souspli.pwa.installShown";

function silenceInstallPrompt() {
  localStorage.setItem(INSTALL_DISMISS_KEY, String(Date.now() + INSTALL_SNOOZE_MS));
  sessionStorage.setItem(INSTALL_SESSION_KEY, "1");
}

export function InstallPrompt() {
  const [open, setOpen] = useState(false);
  const [ios, setIos] = useState(false);

  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10);
    const visit = nextInstallVisit({
      visits: Number(localStorage.getItem(INSTALL_VISITS_KEY) || 0),
      lastVisitDay: localStorage.getItem(INSTALL_DAY_KEY),
      today,
    });
    localStorage.setItem(INSTALL_VISITS_KEY, String(visit.visits));
    localStorage.setItem(INSTALL_DAY_KEY, visit.lastVisitDay);
    const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
    const dismissed = Number(localStorage.getItem(INSTALL_DISMISS_KEY) || 0) || null;
    const offer = shouldOfferInstall({
      now: Date.now(),
      dismissedUntil: dismissed,
      visits: visit.visits,
      standalone,
      alreadyShownThisSession: sessionStorage.getItem(INSTALL_SESSION_KEY) === "1",
    });
    if (!offer) return;
    const apple = /iPhone|iPad/.test(navigator.userAgent);
    setIos(apple);
    const show = () => {
      silenceInstallPrompt();
      setOpen(true);
    };
    const onPrompt = (event: Event) => {
      event.preventDefault();
      (window as Window & { souspliInstall?: Event }).souspliInstall = event;
      show();
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    if (apple) show();
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  return (
    <Modal open={open} onOpenChange={setOpen} title="Installer Sous pli" description="L'application reste utilisable dans le navigateur. L'installation n'est pas obligatoire.">
      {ios ? (
        <p className="text-sm text-muted">Dans Safari, ouvrez le menu Partager, puis choisissez « Sur l'écran d'accueil ».</p>
      ) : (
        <p className="text-sm text-muted">Vous pouvez ajouter Sous pli à votre écran d'accueil pour le retrouver plus vite.</p>
      )}
      <div className="mt-4 flex flex-wrap justify-end gap-2">
        <Button
          variant="secondary"
          onClick={() => {
            silenceInstallPrompt();
            setOpen(false);
          }}
        >
          Plus tard
        </Button>
        {!ios ? (
          <Button
            onClick={async () => {
              const event = (window as Window & { souspliInstall?: { prompt: () => Promise<void> } }).souspliInstall;
              await event?.prompt();
              setOpen(false);
            }}
          >
            Installer
          </Button>
        ) : null}
      </div>
    </Modal>
  );
}
