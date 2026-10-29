import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { CapacitorConfig } from "@capacitor/cli";

const PRODUCTION_URL = "https://souspli.fr";

function debugServerUrl(): string | null {
  if (process.env.CAPACITOR_USE_DEBUG_SERVER !== "1") return null;
  const fromEnv = process.env.CAPACITOR_SERVER_URL?.trim();
  if (fromEnv) return fromEnv;
  const file = resolve("android/local.properties");
  if (!existsSync(file)) return null;
  const line = readFileSync(file, "utf8").split(/\r?\n/).find((row) => row.startsWith("CAPACITOR_SERVER_URL="));
  const value = line?.slice("CAPACITOR_SERVER_URL=".length).trim();
  return value || null;
}

const serverUrl = debugServerUrl() ?? PRODUCTION_URL;
const trustedHost = new URL(serverUrl).hostname;

const config: CapacitorConfig = {
  appId: "fr.javachrist.souspli",
  appName: "SousPli",
  webDir: "mobile/www",
  android: {
    appendUserAgent: "SousPliAndroid",
    backgroundColor: "#f4efe6",
  },
  server: {
    url: serverUrl,
    cleartext: serverUrl.startsWith("http://"),
    androidScheme: "https",
    allowNavigation: [trustedHost],
    errorPath: "offline.html",
  },
};

export default config;
