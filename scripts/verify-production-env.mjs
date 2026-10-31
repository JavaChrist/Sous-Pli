import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const project = process.env.GCLOUD_PROJECT || "";
const productionProject = "souspli-45147";

if (project !== productionProject) {
  console.log(JSON.stringify({ skipped: true, reason: "projet-hors-production" }));
  process.exit(0);
}

const require = createRequire(import.meta.url);
const auth = require(join(root, "node_modules/firebase-tools/lib/auth.js"));
const region = "europe-west1";
const existing = ["launchDraw", "markDiscovered", "setMembers", "selectOffer", "saveEmailTheme"];
const runtime = /^(EVENTARC_|FUNCTION_|K_|FIREBASE_CONFIG$|GCLOUD_PROJECT$|GOOGLE_CLOUD_PROJECT$|GCP_PROJECT$|LOG_EXECUTION_ID$|CLOUD_RUNTIME_)/;
const allowedAdditions = new Set(["PLAY_RTDN_AUDIENCE", "PLAY_RTDN_PUSH_EMAIL"]);

function parse(path) {
  try {
    const out = {};
    for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
      const index = trimmed.indexOf("=");
      out[trimmed.slice(0, index)] = trimmed.slice(index + 1);
    }
    return out;
  } catch {
    return {};
  }
}

function shape(value) {
  if (!value) return "absent";
  if (value.includes("sous-pli-local")) return "local";
  if (value.includes(productionProject)) return "production";
  return "autre";
}

const merged = { ...parse(join(root, "functions/.env")), ...parse(join(root, "functions/.env.souspli-45147")) };
let token = "";
try {
  const account = auth.getGlobalDefaultAccount();
  const tokenResult = await auth.getAccessToken(account?.tokens?.refresh_token, []);
  token = tokenResult?.access_token || "";
} catch {
  console.log(JSON.stringify({ ok: false, blockers: ["session-firebase-illisible"] }));
  process.exit(1);
}
if (!token) {
  console.log(JSON.stringify({ ok: false, blockers: ["session-firebase-absente"] }));
  process.exit(1);
}

async function readFunction(name) {
  const response = await fetch(`https://cloudfunctions.googleapis.com/v2/projects/${productionProject}/locations/${region}/functions/${name}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const body = await response.json().catch(() => null);
  return { status: response.status, env: body?.serviceConfig?.environmentVariables || {}, revision: String(body?.serviceConfig?.revision || "").split("/").pop() || null };
}

const live = {};
for (const name of existing) live[name] = await readFunction(name);
const reference = live.setMembers?.env?.STORAGE_BUCKET || "";
const blockers = [];
if (live.setMembers?.status !== 200 || shape(reference) !== "production") blockers.push("reservoir-production-illisible");
if (shape(merged.STORAGE_BUCKET) !== "production" || merged.STORAGE_BUCKET !== reference) blockers.push("STORAGE_BUCKET");
if (merged.PLAY_PURCHASE_ACCESS !== "test") blockers.push("PLAY_PURCHASE_ACCESS");

const functions = {};
for (const name of existing) {
  const current = live[name];
  if (current.status !== 200) {
    blockers.push(`${name}-illisible`);
    continue;
  }
  const deployed = current.env;
  const keys = new Set([...Object.keys(deployed), ...Object.keys(merged)].filter((key) => !runtime.test(key)));
  const added = [];
  const removed = [];
  const changed = [];
  for (const key of keys) {
    const before = Object.prototype.hasOwnProperty.call(deployed, key);
    const after = Object.prototype.hasOwnProperty.call(merged, key);
    if (before && !after) removed.push(key);
    else if (!before && after) added.push(key);
    else if ((deployed[key] || "") !== (merged[key] || "")) changed.push(key);
  }
  const storageChange = deployed.STORAGE_BUCKET === merged.STORAGE_BUCKET
    ? "inchangé"
    : shape(deployed.STORAGE_BUCKET) === "local" && shape(merged.STORAGE_BUCKET) === "production"
      ? "local-vers-production"
      : "autre";
  if (storageChange === "autre") blockers.push(`${name}-STORAGE_BUCKET`);
  for (const key of removed) blockers.push(`${name}-retrait-${key}`);
  for (const key of changed) {
    if (key === "STORAGE_BUCKET" && storageChange === "local-vers-production") continue;
    blockers.push(`${name}-changement-${key}`);
  }
  for (const key of added) {
    if (!allowedAdditions.has(key)) blockers.push(`${name}-ajout-${key}`);
  }
  functions[name] = {
    revision: current.revision,
    storage: storageChange,
    accessTest: deployed.PLAY_PURCHASE_ACCESS === "test" && merged.PLAY_PURCHASE_ACCESS === "test",
    added: added.sort(),
    removed: removed.sort(),
    changed: changed.filter((key) => !(key === "STORAGE_BUCKET" && storageChange === "local-vers-production")).sort(),
  };
}

const report = {
  ok: blockers.length === 0,
  blockers,
  storagePinned: merged.STORAGE_BUCKET === reference && shape(reference) === "production",
  accessTest: merged.PLAY_PURCHASE_ACCESS === "test",
  operatorConfigured: (merged.MOLLIE_OPERATOR_UIDS || "").split(",").map((item) => item.trim()).filter(Boolean).length === 1,
  functions,
};
console.log(JSON.stringify(report, null, 2));
process.exit(report.ok ? 0 : 1);
