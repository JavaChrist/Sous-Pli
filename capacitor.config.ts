import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { CapacitorConfig } from "@capacitor/cli";

const PRODUCTION_URL = "https://souspli.fr";

function readProperty(name: string): string {
  const fromEnv = process.env[name]?.trim();
  if (fromEnv) return fromEnv;
  const file = resolve("android/local.properties");
  if (!existsSync(file)) return "";
  const line = readFileSync(file, "utf8").split(/\r?\n/).find((row) => row.startsWith(`${name}=`));
  return line?.slice(name.length + 1).trim() ?? "";
}

function serverUrl(): string {
  if (process.env.CAPACITOR_USE_DEBUG_SERVER !== "1") return PRODUCTION_URL;
  const target = readProperty("CAPACITOR_DEBUG_TARGET") || "local";
  const key = target === "preview" ? "CAPACITOR_PREVIEW_URL" : target === "local" ? "CAPACITOR_LOCAL_URL" : "";
  if (!key) throw new Error(`Cible Android inconnue : ${target}. Utilisez local ou preview.`);
  const url = readProperty(key);
  if (!url) throw new Error(`L'adresse ${key} est vide. Le build debug ne bascule pas sur le site public.`);
  const parsed = new URL(url);
  if (parsed.hostname === "souspli.fr" || parsed.hostname === "www.souspli.fr") {
    throw new Error("Le build debug ne doit pas charger le site public.");
  }
  if (target === "local" && parsed.protocol !== "http:") throw new Error("La cible locale doit utiliser HTTP vers l'hôte de l'émulateur.");
  if (target === "preview" && parsed.protocol !== "https:") throw new Error("La prévisualisation doit rester en HTTPS.");
  return url;
}

const url = serverUrl();
const trustedHost = new URL(url).hostname;

const config: CapacitorConfig = {
  appId: "fr.javachrist.souspli",
  appName: "SousPli",
  webDir: "mobile/www",
  android: {
    appendUserAgent: "SousPliAndroid",
    backgroundColor: "#f4efe6",
  },
  server: {
    url,
    cleartext: url.startsWith("http://"),
    androidScheme: "https",
    allowNavigation: [trustedHost],
    errorPath: "offline.html",
  },
};

export default config;
