# AGENTS.md

Context for AI assistants working in this repository.

## Background

The official [API for Cursor](https://api-for-cursor.standardagents.ai/) is a **macOS** app. [AppleLamps/cursor-api](https://github.com/AppleLamps/cursor-api) is the **Windows** tray app with the same goal: local OpenAI-compatible `/v1` for harnesses, backed by vendored [composer-api](https://github.com/standardagents/composer-api) and `@cursor/sdk`. Prefer editing `electron/`; treat `vendor/composer-api` as upstream unless fixing Windows dev or contributing patches back.

Indexing: `.cursorignore` excludes `node_modules`, `dist/`, and most of `vendor/composer-api` (including `macos/`). Read `vendor/PINNED_COMMIT` before changing upstream behavior.

## What this repo is

Windows **Electron** wrapper around vendored [standardagents/composer-api](https://github.com/standardagents/composer-api). It is not the macOS Swift app; do not edit `vendor/composer-api/macos/` for Windows features.

## Where to change things

| Goal | Location |
|------|----------|
| Tray / IPC / window | `electron/main.ts`, `electron/preload.ts` |
| Start/stop stack | `electron/server-controller.ts`, `electron/service-start.ts`, `electron/process-manager.ts` |
| Codex TOML install | `electron/toml-blocks.ts`, `electron/provisioner.ts` |
| Public `/v1` + key substitution | `electron/auth-proxy.ts`, `electron/auth-tokens.ts` |
| Agent install | `electron/provisioner.ts` |
| Dashboard UI | `electron/renderer/` |
| OpenAI routes / Cursor SDK | `vendor/composer-api/worker/`, `vendor/composer-api/scripts/` |
| Windows Vite port | `vendor/composer-api/vite.electron.config.ts` |
| Disable CF containers on Windows | `vendor/composer-api/wrangler.jsonc` → `dev.enable_containers` |

## Conventions

- TypeScript in `electron/` compiles to `dist/`; import paths use `.js` extensions.
- ESM (`"type": "module"`); use `import.meta.url` for `__dirname`, not `__dirname` global.
- Settings: `%USERPROFILE%\.api-for-cursor\settings.json`; API key encrypted via `electron.safeStorage` when available.
- Default ports: public 8787, worker 18787, bridge 8792; may auto-increment if busy.
- Placeholder Bearer token for harnesses: `cursor-local`.

## Do not

- Commit `vendor/composer-api/.dev.vars`, user API keys, or `.api-for-cursor` settings.
- Re-enable Cloudflare `enable_containers: true` for Windows dev without documenting WSL requirement.
- Run destructive git commands unless the user asks.

## Verify changes

```bash
npm run build
npm test
npm run vendor:prepare   # required before smoke
npm run smoke            # full stack; needs CURSOR_API_KEY in .env
npm run dev
```

Manual: save API key → Start server → `curl http://127.0.0.1:8787/v1/models -H "Authorization: Bearer cursor-local"`.

## User-facing docs

- [README.md](README.md)
- [docs/roadmap.md](docs/roadmap.md)
- [docs/vendor.md](docs/vendor.md)
- [docs/integrations.md](docs/integrations.md)
- [docs/development.md](docs/development.md)
- [docs/troubleshooting.md](docs/troubleshooting.md)
- [CHANGELOG.md](CHANGELOG.md)
