/**
 * Prepare vendor + TypeScript before electron-builder (Windows .exe).
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const vendor = path.join(root, "vendor", "composer-api");

function run(command, args, opts = {}) {
  const result = spawnSync(command, args, {
    cwd: root,
    stdio: "inherit",
    shell: true,
    ...opts
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

if (!fs.existsSync(path.join(vendor, "package.json"))) {
  console.error("[prepare-pack] Missing vendor/composer-api");
  process.exit(1);
}

console.log("[prepare-pack] Installing vendor dependencies…");
run("node", ["scripts/install-vendor.mjs"]);

console.log("[prepare-pack] Applying local D1 migrations…");
run("npm", ["run", "vendor:prepare"]);

console.log("[prepare-pack] Compiling Electron app…");
run("npm", ["run", "build"]);

console.log("[prepare-pack] Ready for electron-builder.");
