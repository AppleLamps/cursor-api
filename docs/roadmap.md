# Roadmap

Windows wrapper goals and status. For coding agents: treat **`electron/`** as this product; **`vendor/composer-api`** is upstream.

## Done (0.1.0)

- [x] Electron tray + dashboard UI
- [x] Local OpenAI-compatible `/v1` via auth proxy + composer-api worker + SDK bridge
- [x] Cursor API key storage (DPAPI via `safeStorage` when available)
- [x] One-click setup for OpenCode, Codex, VS Code family, Cline, Kilo, pi
- [x] Windows dev fixes (containers off, dedicated Vite port)
- [x] Agent-oriented docs (`AGENTS.md`, `.cursorignore`)
- [x] Public repo: [github.com/AppleLamps/cursor-api](https://github.com/AppleLamps/cursor-api)
- [x] Unit tests + Windows CI (`npm test`, GitHub Actions)

## Next

| Item | Notes |
|------|--------|
| **Vendor sync** | Script or fork to merge upstream composer-api; see [vendor.md](vendor.md) |
| **Windows installer** | `electron-builder` or similar; ship Node/runtime or document prerequisites |
| **Production server** | Optional slim local server instead of full Vite dev worker |
| **More harnesses** | Continue, Aider, Roo (parity with macOS app where feasible) |
| **Upstream PRs** | `enable_containers` default, shared Electron Vite config |
| **Tests** | Optional Electron integration smoke; unit tests in `test/` + CI |

## Non-goals (for now)

- Reimplementing macOS Swift UI in this repo
- Hosting the worker on Cloudflare from this Windows tray app
- Affiliation or endorsement by Cursor
