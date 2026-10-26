import { readFileSync } from "node:fs";
import { spawn } from "node:child_process";

function projectId() {
  try {
    const text = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
    const line = text.split(/\r?\n/).find((row) => row.startsWith("NEXT_PUBLIC_FIREBASE_PROJECT_ID="));
    const value = line?.slice("NEXT_PUBLIC_FIREBASE_PROJECT_ID=".length).trim().replace(/^["']|["']$/g, "");
    if (value) return value;
  } catch {
    // Le fichier local est absent : on reste sur le projet d'émulation par défaut.
  }
  return "sous-pli-local";
}

const child = spawn("firebase", ["emulators:start", "--project", projectId()], {
  stdio: "inherit",
  shell: true,
});

child.on("exit", (code) => process.exit(code ?? 1));
