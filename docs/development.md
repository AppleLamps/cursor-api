# Development

Guide for working on the Windows Electron wrapper and the vendored `composer-api` tree.

## Prerequisites

- Windows 10/11 (native; WSL is not required for the Electron path)
- Node.js 20+
- Git

## First-time setup

```bash
git clone https://github.com/AppleLamps/cursor-api.git cursor-api
cd cursor-api
npm install
npm run vendor:prepare
```

If the vendor tree is missing, see [vendor.md](vendor.md).

`postinstall` runs `npm install` inside `vendor/composer-api`.

## Run loop

```bash
npm run dev
```

This compiles TypeScript (`electron/` → `dist/`) and launches Electron.

Equivalent:

```bash
npm run build
npm start
```

## Architecture (code map)

| Module | Responsibility |
|--------|----------------|
| `electron/main.ts` | Window, tray, IPC handlers |
| `electron/server-controller.ts` | Orchestrates bridge + worker + proxy lifecycle |
| `electron/process-manager.ts` | Spawns bridge script and Vite; tails logs |
| `electron/auth-proxy.ts` | Local HTTP proxy on `publicPort` |
| `electron/provisioner.ts` | Agent config install/status |
| `electron/settings.ts` | `~/.api-for-cursor/settings.json` |
| `electron/secrets.ts` | DPAPI encrypt/decrypt for API key |
| `electron/port-utils.ts` | Free port detection |
| `vendor/composer-api/worker/` | OpenAI-compatible Cloudflare worker |
| `vendor/composer-api/scripts/cursor-sdk-local-agent-bridge.mjs` | SDK local agent bridge |

## Running services manually (debugging)

Usually the app starts everything. For isolated debugging:

**Terminal 1 — bridge**

```bash
cd vendor/composer-api
set CURSOR_SDK_BRIDGE_PORT=8792
node scripts/cursor-sdk-local-agent-bridge.mjs
```

**Terminal 2 — worker (Windows)**

```bash
cd vendor/composer-api
npx vite --config vite.electron.config.ts --host 127.0.0.1 --port 18787 --strictPort
```

Requires `.dev.vars` with `CURSOR_SDK_BRIDGE_URL=http://127.0.0.1:8792/sdk` (the app writes this on start).

**Terminal 3 — auth proxy**

Use the Electron app, or exercise the worker directly:

```bash
curl http://127.0.0.1:18787/v1/models -H "Authorization: Bearer <your-cursor-key>"
```

## Vendor updates

To refresh upstream:

```bash
cd vendor/composer-api
git fetch origin
git checkout main
git pull
cd ../..
npm install
npm run vendor:prepare
```

Re-apply local patches if needed:

- `wrangler.jsonc` → `dev.enable_containers: false`
- `vite.electron.config.ts` (Electron-specific; keep in vendor or override path in `process-manager.ts`)

## Upstream worker dev (without Electron)

From `vendor/composer-api`:

```bash
npm run db:migrate:local
npm run dev
```

On **native Windows**, plain `npm run dev` fails unless `enable_containers` is false in `wrangler.jsonc`. Prefer the Electron app’s Vite config or WSL for full container parity.

## TypeScript

- Root `tsconfig.json` compiles only `electron/`
- Output: `dist/`
- Renderer is plain HTML/JS under `electron/renderer/` (not bundled)

## Adding an agent integration

1. Add an `IntegrationId` in `electron/provisioner.ts`.
2. Implement `statusFor` and `install*` with Windows paths (`%APPDATA%`, `%USERPROFILE%\.config`, etc.).
3. Add a row in `electron/renderer/app.js` `labelFor`.
4. Document in [integrations.md](integrations.md).

Match behavior of `macos/CursorAPI/Sources/CursorAPICore/AgentProvisioner.swift` when possible.

## Future packaging

Not implemented yet:

- `electron-builder` for a portable `.exe` / installer
- Bundling Node + vendor without a separate `npm install` in vendor

Track issues/PRs if you add packaging.

## Tests

There is no automated test suite in this wrapper yet. Smoke-test manually:

1. Save API key → Start server → `GET /v1/models` with `cursor-local`
2. Install one harness → run a short prompt
3. Stop server → confirm ports released

Consider adding Vitest for `auth-proxy`, `provisioner`, and `port-utils` without Electron.
