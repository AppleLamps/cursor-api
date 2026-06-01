# Troubleshooting

Common issues when running API for Cursor on Windows.

## Server will not start

### “Save a Cursor API key before starting”

Save a valid key from [Cursor Dashboard → Integrations](https://cursor.com/dashboard?tab=integrations) in the app, then click **Save** before **Start server**.

### Port already in use

The app tries the default ports and then the next free ports (`8787`, `18787`, `8792` by default). If start still fails:

1. Stop the server from the dashboard or tray.
2. Check nothing else is bound:

```powershell
netstat -ano | findstr "8787 18787 8792"
```

3. End stray Node/Electron processes from a previous run if needed.
4. Start again and note the **Base URL** in the dashboard (port may have changed). Re-run **Install** on harnesses if the port changed.

### Vite / Cloudflare: containers not supported on Windows

Error text like:

```text
Local development with containers is currently not supported on Windows
```

**Fix:** Use this repo’s vendored `wrangler.jsonc` (should include `"dev": { "enable_containers": false }`). Do not run raw `npm run dev` in `vendor/composer-api` without that patch. Use the Electron app or `vite.electron.config.ts`.

### Timed out waiting for http://127.0.0.1:…/health or /v1/models

- Ensure `npm run vendor:prepare` completed successfully.
- Delete `vendor/composer-api/.wrangler` and run `vendor:prepare` again if D1 looks corrupt.
- Check dashboard **Logs** for `[bridge]` or `[worker]` stderr (missing deps, antivirus blocking Node, etc.).
- Run `npm install` in repo root and allow `postinstall` to finish in `vendor/composer-api`.

### Bridge or worker exited unexpectedly

The dashboard should show an error such as `bridge process exited` or `worker process exited`. Click **Stop server**, fix the cause in logs, then **Start server** again.

Typical causes:

- Antivirus terminated child Node processes
- `vendor/composer-api/node_modules` incomplete — run `npm install` at repo root
- Cursor SDK error — verify API key and that Cursor CLI/runtime expectations are met

## 401 Unauthorized from harness

| Symptom | Fix |
|---------|-----|
| `Cursor API key is not configured` | Save key in app; use `cursor-local` in harness or real key in proxy tests |
| Works with real key but not `cursor-local` | Restart server after saving key |
| 401 from worker only | Pass `Authorization: Bearer <cursor-key>` to port `18787` to isolate proxy vs worker |

## Harness cannot connect

1. Confirm server status **Ready**.
2. Base URL must be `http://127.0.0.1:<port>/v1` — use the dashboard value, not an old port.
3. Windows Firewall: allow Node/Electron on private networks for localhost (usually not prompted for 127.0.0.1).
4. HTTPS clients pointing at `http://127.0.0.1` will fail — use HTTP only.

## Codex / Responses: tools not supported

```json
{
  "error": {
    "message": "OpenAI Responses tools are not supported by this Cursor adapter.",
    "param": "tools"
  }
}
```

This comes from upstream composer-api. Options:

- Use Chat Completions–compatible settings where possible
- Watch [composer-api issues](https://github.com/standardagents/composer-api/issues) for updates
- Use the macOS app flow documentation for Codex profile hints

## OpenCode / Cline does not list models

- Re-run **Install** after the server is **Ready**.
- Restart the editor or CLI tool.
- Open the config path listed in the dashboard integration row and confirm `baseURL` / `base_url` matches the dashboard.

## API key / settings

| Location | Content |
|----------|---------|
| `%USERPROFILE%\.api-for-cursor\settings.json` | Ports, `autoStartServer`, encrypted key |

To reset:

1. Stop server.
2. Close app.
3. Rename or delete `%USERPROFILE%\.api-for-cursor\`.
4. Restart app and re-enter API key.

## Restore botched harness config

Look next to the config file for backups:

```text
opencode.json.api-for-cursor-backup.1730000000000
```

Copy the backup over the broken file with the app and harness closed.

## Electron window blank or crashes on launch

```bash
npm run build
npm run dev
```

Check terminal for TypeScript errors. Ensure `electron/renderer/index.html` exists (loaded from source, not `dist/`).

## Getting more log detail

- Dashboard **Logs** section (last ~200 lines)
- Tray → start/stop and reproduce
- Manual worker/bridge terminals — see [development.md](development.md)

## Still stuck?

1. Note exact error from dashboard or harness.
2. Note ports from dashboard when **Ready**.
3. Open an issue with logs (redact API keys), Windows version, and Node version (`node -v`).

Upstream API behavior: [standardagents/composer-api](https://github.com/standardagents/composer-api/issues).
