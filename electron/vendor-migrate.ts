import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { composerApiRoot } from "./paths.js";

/** Apply local D1 migrations before first worker start (dev and packaged). */
export function ensureVendorMigrations(): void {
  const root = composerApiRoot();
  const wranglerJs = path.join(root, "node_modules", "wrangler", "bin", "wrangler.js");
  if (!fs.existsSync(wranglerJs)) {
    return;
  }
  spawnSync(process.execPath, [wranglerJs, "d1", "migrations", "apply", "composer-api", "--local"], {
    cwd: root,
    stdio: "pipe",
    windowsHide: true
  });
}
