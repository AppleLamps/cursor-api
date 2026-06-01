# CI full-stack smoke test

The smoke test starts the real Electron server stack (bridge → Vite worker → auth proxy), calls `GET /v1/models` with `Bearer cursor-local`, and exits.

## Local

1. Copy [.env.example](../.env.example) to `.env` and set your Cursor API key.
2. Prepare vendor once: `npm run vendor:prepare`
3. Run:

```bash
npm run smoke
```

Optional timeouts (slow machines / CI-like):

```powershell
$env:SMOKE_HEALTH_TIMEOUT_MS = "120000"
$env:SMOKE_HTTP_TIMEOUT_MS = "120000"
$env:SMOKE_DEADLINE_MS = "300000"
npm run smoke
```

Uses an isolated settings directory (`%TEMP%\api-for-cursor-smoke` by default), not your normal dashboard settings.

## GitHub Actions

Add a repository secret:

| Name | Value |
|------|--------|
| `CURSOR_API_KEY` | Your `cr_…` key from [Cursor Dashboard → Integrations](https://cursor.com/dashboard?tab=integrations) |

**Settings → Secrets and variables → Actions → New repository secret**

Name must be exactly `CURSOR_API_KEY` (same variable as in `.env` locally).

The `smoke` job runs on every `main` / PR build. If the secret is missing, the step exits successfully with a notice (unit tests still run in `build-test`). Fork PRs from outside contributors do not receive secrets and skip the actual smoke run.

Do not commit `.env` — it is gitignored.
