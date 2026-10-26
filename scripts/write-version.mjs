import { writeFileSync } from "node:fs";

const version = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z");
writeFileSync("shared/build-version.ts", `export const BUILD_VERSION = ${JSON.stringify(version)};\n`);
writeFileSync("public/version.json", JSON.stringify({ version }, null, 2) + "\n");
console.log(version);
