/**
 * Install vendor/composer-api deps in a way that works on Windows CI
 * (postinstall nested `npm` often loses PATH).
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const vendor = path.join(root, "vendor", "composer-api");

if (!fs.existsSync(path.join(vendor, "package.json"))) {
  console.error("[install-vendor] Missing vendor/composer-api — clone or vendor the tree first.");
  process.exit(1);
}

const npmCmd = process.platform === "win32" ? "npm.cmd" : "npm";
const useCi = fs.existsSync(path.join(vendor, "package-lock.json"));
const args = useCi ? ["ci"] : ["install"];

const result = spawnSync(npmCmd, args, {
  cwd: vendor,
  stdio: "inherit",
  env: process.env,
  shell: true
});

process.exit(result.status === 0 ? 0 : 1);
