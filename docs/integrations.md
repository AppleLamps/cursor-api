# Agent integrations

The dashboard **Install** button writes provider configuration so each harness uses your **local** API base URL (for example `http://127.0.0.1:8787/v1`) and a placeholder API key the auth proxy understands.

**Start the server first** so the saved base URL matches the port shown in the dashboard. Install is disabled until status is **Ready**.

## Shared conventions

- **Base URL:** `http://127.0.0.1:<publicPort>/v1` (no trailing slash on `/v1` in some tools — match what the dashboard shows)
- **API key in harness config:** `cursor-local` (recommended)
- **Models:** `composer-2.5`, `composer-2.5-fast`

The app replaces `Bearer cursor-local` (and related placeholders) with your real Cursor API key. See the main [README](../README.md#placeholder-api-keys).

## OpenCode

**Install writes:** `%USERPROFILE%\.config\opencode\opencode.json`

Adds provider `cursorapi` using `@ai-sdk/openai-compatible` with models `composer-2.5` and `composer-2.5-fast`.

**Manual snippet** (provider section):

```json
{
  "provider": {
    "cursorapi": {
      "npm": "@ai-sdk/openai-compatible",
      "name": "API for Cursor",
      "options": {
        "baseURL": "http://127.0.0.1:8787/v1",
        "apiKey": "cursor-local"
      },
      "models": {
        "composer-2.5": { "name": "Cursor Composer 2.5" },
        "composer-2.5-fast": { "name": "Cursor Composer 2.5 Fast" }
      }
    }
  },
  "model": "cursorapi/composer-2.5-fast"
}
```

## Codex

**Install writes:**

- `%USERPROFILE%\.codex\config.toml` — provider `cursorapi`, `wire_api = "responses"`
- `%USERPROFILE%\.codex\cursorapi.config.toml` — profile for `composer-2.5`
- `%USERPROFILE%\.codex\cursorapi-fast.config.toml` — profile for `composer-2.5-fast`

On Windows, auth uses `cmd /c echo cursor-local` so Codex can obtain a token without a real secret in config.

**Note:** Codex with the Responses API and **tool calling** may fail with an upstream error that Responses `tools` are not supported. If that happens, try Chat Completions–style wiring or follow [composer-api issues](https://github.com/standardagents/composer-api/issues).

## VS Code, Cursor, Windsurf, VSCodium

**Install writes:** `chatLanguageModels.json` under the first detected editor profile:

```text
%APPDATA%\Code\User\chatLanguageModels.json
%APPDATA%\Cursor\User\chatLanguageModels.json
…
```

Adds an `openai-compatible` entry named **API for Cursor** with both Composer models.

## Cline

**Install writes:**

- `%USERPROFILE%\.cline\data\globalState.json` — OpenAI provider, base URL, model IDs, model info
- `%USERPROFILE%\.cline\data\secrets.json` — `openAiApiKey: "cursor-local"`

Restart Cline or reload window if it does not pick up changes immediately.

## Kilo Code

**Install writes:** `%USERPROFILE%\.config\kilo\kilo.jsonc`

Provider `cursorapi` with OpenAI-compatible options.

## pi

**Install writes:** `%USERPROFILE%\.pi\agent\models.json`

Provider `cursorapi` with `openai-completions` API mode.

## Not yet automated on Windows

The macOS app also supports **Continue**, **Aider**, and **Roo Code**. Those are not in the Windows installer yet; you can still point them manually at the same base URL and `cursor-local` if the tool supports custom OpenAI endpoints.

## Backups

Before overwriting a file, the provisioner copies the previous version to:

```text
<original-path>.api-for-cursor-backup.<timestamp>
```

Restore from backup if an install misconfigures a tool.

## Verifying an integration

1. Server status **Ready** in the dashboard.
2. In the harness, select a Composer model routed through **API for Cursor** / `cursorapi`.
3. Send a short prompt; check dashboard **Logs** for `[bridge]` / `[worker]` lines.
4. If you get `401`, save your Cursor API key again in the app.
5. If you get connection errors, confirm the harness base URL matches the dashboard **Base URL** exactly.
