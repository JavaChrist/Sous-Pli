import { useSyncExternalStore } from "react";
import { Capacitor, registerPlugin, type PluginListenerHandle } from "@capacitor/core";
import { App } from "@capacitor/app";
import { Browser } from "@capacitor/browser";
import { GoogleAuthProvider, linkWithCredential, signInWithCredential, signInWithPopup, reauthenticateWithCredential, reauthenticateWithPopup, type Auth, type User, type UserCredential } from "firebase/auth";
import { accountExportTransport, androidBackAction, googleSignInPlan, isPreparedEntryPath, keepsAnonymousSession, linkDisposition, type ShellPlatform } from "@shared/native-shell";

interface GoogleNativePlugin {
  signIn(): Promise<{ idToken?: string; cancelled?: boolean }>;
}

interface FilesNativePlugin {
  saveText(options: { filename: string; text: string; mime: string }): Promise<void>;
}

const GoogleNative = registerPlugin<GoogleNativePlugin>("SousPliGoogle");
const FilesNative = registerPlugin<FilesNativePlugin>("SousPliFiles");

export function shellPlatform(): ShellPlatform {
  if (typeof window === "undefined") return "web";
  if (Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android") return "android";
  if (navigator.userAgent.includes("SousPliAndroid")) return "android";
  return "web";
}

export function useShellPlatform(): ShellPlatform {
  return useSyncExternalStore(subscribeShell, shellPlatform, () => "web");
}

function subscribeShell() {
  return () => undefined;
}

export async function signInWithGoogle(auth: Auth): Promise<UserCredential | null> {
  const plan = googleSignInPlan({
    platform: shellPlatform(),
    anonymous: Boolean(auth.currentUser?.isAnonymous),
    purpose: "sign-in",
  });
  if (plan === "popup") return signInWithPopup(auth, new GoogleAuthProvider());
  const native = await GoogleNative.signIn();
  if (native.cancelled || !native.idToken) return null;
  const credential = GoogleAuthProvider.credential(native.idToken);
  if (plan === "credential-link") {
    const current = auth.currentUser;
    if (!current) throw new Error("La session d’invitation a disparu. Aucun autre compte n’a été ouvert.");
    try {
      return await linkWithCredential(current, credential);
    } catch (caught) {
      const code = caught && typeof caught === "object" && "code" in caught ? String(caught.code) : "";
      if (keepsAnonymousSession(code)) {
        throw new Error("Ce compte Google existe déjà. La session d’invitation est conservée. Ouvrez la connexion pour utiliser ce compte, sans en créer un second.");
      }
      throw caught;
    }
  }
  return signInWithCredential(auth, credential);
}

export async function reauthenticateWithGoogle(user: User): Promise<UserCredential> {
  const plan = googleSignInPlan({ platform: shellPlatform(), anonymous: user.isAnonymous, purpose: "reauth" });
  if (plan === "popup") return reauthenticateWithPopup(user, new GoogleAuthProvider());
  const native = await GoogleNative.signIn();
  if (native.cancelled || !native.idToken) throw new Error("La confirmation Google a été fermée avant la fin.");
  const credential = GoogleAuthProvider.credential(native.idToken);
  return reauthenticateWithCredential(user, credential);
}

export async function saveAccountExport(json: string): Promise<void> {
  if (accountExportTransport(shellPlatform()) === "system-document") {
    await FilesNative.saveText({ filename: "sous-pli-export.json", text: json, mime: "application/json" });
    return;
  }
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "sous-pli-export.json";
  anchor.click();
  URL.revokeObjectURL(url);
}

export async function openExternal(href: string): Promise<void> {
  if (href.startsWith("mailto:") || href.startsWith("tel:")) {
    window.location.href = href;
    return;
  }
  await Browser.open({ url: href });
}

export function watchAndroidChrome(): () => void {
  if (shellPlatform() !== "android") return () => undefined;
  const onClick = (event: MouseEvent) => {
    const anchor = (event.target as Element | null)?.closest?.("a");
    if (!anchor) return;
    const href = anchor.href;
    if (!href || linkDisposition(href, window.location.hostname) !== "system") return;
    event.preventDefault();
    void openExternal(href);
  };
  const onViewport = () => {
    const viewport = window.visualViewport;
    const keyboard = Boolean(viewport && window.innerHeight - viewport.height > 120);
    document.documentElement.classList.toggle("keyboard-open", keyboard);
  };
  document.addEventListener("click", onClick, true);
  window.visualViewport?.addEventListener("resize", onViewport);
  const openPrepared = (url?: string) => {
    if (!url || linkDisposition(url, window.location.hostname) !== "internal") return;
    const next = new URL(url);
    if (!isPreparedEntryPath(next.pathname)) return;
    if (window.location.pathname !== next.pathname || window.location.search !== next.search) {
      window.location.assign(next.href);
    }
  };
  let backHandle: PluginListenerHandle | undefined;
  let urlHandle: PluginListenerHandle | undefined;
  void App.addListener("backButton", ({ canGoBack }) => {
    if (androidBackAction(canGoBack, window.location.pathname, window.history.length) === "history") window.history.back();
    else void App.exitApp();
  }).then((handle) => {
    backHandle = handle;
  });
  void App.addListener("appUrlOpen", (event) => openPrepared(event.url)).then((handle) => {
    urlHandle = handle;
  });
  void App.getLaunchUrl().then((launch) => openPrepared(launch?.url));
  return () => {
    document.removeEventListener("click", onClick, true);
    window.visualViewport?.removeEventListener("resize", onViewport);
    document.documentElement.classList.remove("keyboard-open");
    void backHandle?.remove();
    void urlHandle?.remove();
  };
}
