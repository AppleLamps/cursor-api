# Changelog

All notable changes to the **Windows Electron wrapper** (this repo). Upstream [composer-api](https://github.com/standardagents/composer-api) has its own history in `vendor/composer-api`.

## [0.1.0] — 2026-06-01

### Added

- Electron tray app with dashboard (API key, start/stop server, integration installers)
- Three-process stack: auth proxy (8787), Vite worker (18787), SDK bridge (8792)
- Auth proxy with placeholder Bearer tokens (`cursor-local`, etc.) and CORS/OPTIONS
- Process supervision, port fallback, API-key gate before start
- Provisioners for OpenCode, Codex, VS Code/Cursor/Windsurf, Cline, Kilo Code, pi (with config backups)
- Windows vendor patches: `enable_containers: false`, `vite.electron.config.ts`
- Documentation: README, `docs/`, `AGENTS.md`

### Known gaps

- No Windows installer (`electron-builder`)
- Dev worker runs full Vite; no slim bundled server like macOS Swift `LocalAPIServer`
- No Continue / Aider / Roo installers (macOS app has some of these)
- No automated tests in the wrapper

See [docs/roadmap.md](docs/roadmap.md) for planned work.
