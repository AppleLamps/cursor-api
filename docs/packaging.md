# Windows `.exe` builds

Package the tray app so you can double-click instead of `npm run dev`.

## Requirements

- Windows 10/11
- Node.js 22+
- ~2 GB free disk (vendor `node_modules` is bundled)

## Portable `.exe` (easiest)

Single file, no installer — good for USB or quick try:

```bash
npm install
npm run pack
```

Output:

```text
release/API-for-Cursor-0.1.0-portable.exe
```

Double-click → tray icon → open dashboard → save API key → **Start server**.

## Setup installer (optional)

```bash
npm run pack:setup
```

Creates `release/API-for-Cursor-0.1.0-setup.exe` (NSIS wizard, Start Menu shortcut).

## What gets bundled

- Electron shell (`dist/`)
- Dashboard UI (`renderer/`)
- Full `vendor/composer-api` including `node_modules` (bridge + Vite worker)

First **Start server** runs D1 migrations automatically (same as `vendor:prepare`).

## Size and updates

The portable build is **large** (often 300–600+ MB) because it ships Node, Electron, and the worker dependencies. Re-run `npm run pack` after pulling updates.

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Pack fails on `install-vendor` | Run `npm run install:vendor` manually |
| Server won’t start from `.exe` | Windows Defender may block child Node processes — allow the app |
| Old settings | Still uses `%USERPROFILE%\.api-for-cursor\settings.json` |

Development builds are unchanged: `npm run dev`.
