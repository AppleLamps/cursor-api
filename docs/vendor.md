# Vendored composer-api

Upstream: [standardagents/composer-api](https://github.com/standardagents/composer-api) (MIT).

## In this repo

`vendor/composer-api` is **committed in-tree** (not a submodule) so Windows-specific patches ship with [AppleLamps/cursor-api](https://github.com/AppleLamps/cursor-api):

| File | Change |
|------|--------|
| `wrangler.jsonc` | `"dev": { "enable_containers": false }` |
| `vite.electron.config.ts` | Worker dev on port `18787` |

Base upstream revision (before patches): see `vendor/PINNED_COMMIT`.

After clone:

```bash
npm install
npm run vendor:prepare
```

Do not commit `vendor/composer-api/.dev.vars` (generated at runtime; listed in `.gitignore`).

## Refresh from upstream

```bash
cd vendor/composer-api
git init
git remote add origin https://github.com/standardagents/composer-api.git
git fetch origin
git checkout d3eabd756c33cd7758db408f9adad623124df570
# Re-apply Windows patches (wrangler.jsonc, vite.electron.config.ts), then test.
cd ../..
```

Or replace the directory with a fresh clone at `vendor/PINNED_COMMIT`, re-apply patches, and commit.

Bump `vendor/PINNED_COMMIT` and [CHANGELOG.md](../CHANGELOG.md) when you intentionally advance upstream.

## Optional: submodule or fork

If you prefer a submodule pointing at a **fork** that contains the Windows patches, remove the in-tree `vendor/composer-api`, add the submodule to your fork URL, and update the root README clone instructions.
