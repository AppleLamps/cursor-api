import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { publicBaseUrl } from "./settings.js";

export type IntegrationId = "opencode" | "codex" | "vscode" | "cline" | "kilo" | "pi";

export interface IntegrationStatus {
  id: IntegrationId;
  installed: boolean;
  configPath: string | null;
  detail: string;
  canInstall: boolean;
}

const MODELS = ["composer-2.5", "composer-2.5-fast"] as const;
const BRAND = "API for Cursor";
const BACKUP_MARKER = "api-for-cursor-backup";

function homeDir(): string {
  return os.homedir();
}

function configHome(): string {
  const xdg = process.env.XDG_CONFIG_HOME;
  if (xdg && path.isAbsolute(xdg)) return xdg;
  return path.join(homeDir(), ".config");
}

function appDataDir(name: string): string {
  const appData = process.env.APPDATA;
  if (appData) return path.join(appData, name);
  return path.join(homeDir(), "AppData", "Roaming", name);
}

function readText(filePath: string): string {
  try {
    return fs.readFileSync(filePath, "utf8");
  } catch {
    return "";
  }
}

function writeText(filePath: string, text: string): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  backupIfChanged(filePath, text);
  fs.writeFileSync(filePath, text, "utf8");
}

function backupIfChanged(filePath: string, nextText: string): void {
  if (!fs.existsSync(filePath)) return;
  const current = fs.readFileSync(filePath);
  const next = Buffer.from(nextText, "utf8");
  if (current.equals(next)) return;
  const stamp = Date.now();
  const backupPath = `${filePath}.${BACKUP_MARKER}.${stamp}`;
  fs.copyFileSync(filePath, backupPath);
}

function readJson(filePath: string, fallback: unknown): unknown {
  const text = readText(filePath);
  if (!text.trim()) return fallback;
  return JSON.parse(text);
}

function writeJson(filePath: string, value: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const text = `${JSON.stringify(value, null, 2)}\n`;
  backupIfChanged(filePath, text);
  fs.writeFileSync(filePath, text, "utf8");
}

function baseUrl(port: number): string {
  return publicBaseUrl(port);
}

export function listIntegrationStatuses(publicPort: number): IntegrationStatus[] {
  return (
    ["opencode", "codex", "vscode", "cline", "kilo", "pi"] as IntegrationId[]
  ).map((id) => statusFor(id, publicPort));
}

export function installIntegration(id: IntegrationId, publicPort: number): IntegrationStatus {
  const url = baseUrl(publicPort);
  switch (id) {
    case "opencode":
      installOpenCode(url);
      break;
    case "codex":
      installCodex(url);
      break;
    case "vscode":
      installVSCode(url);
      break;
    case "cline":
      installCline(url);
      break;
    case "kilo":
      installKilo(url);
      break;
    case "pi":
      installPi(url);
      break;
  }
  return statusFor(id, publicPort);
}

function statusFor(id: IntegrationId, publicPort: number): IntegrationStatus {
  const url = baseUrl(publicPort);
  switch (id) {
    case "opencode": {
      const configPath = path.join(configHome(), "opencode", "opencode.json");
      if (!fs.existsSync(configPath)) {
        return { id, installed: false, configPath, detail: "OpenCode config not found", canInstall: true };
      }
      const root = readJson(configPath, {}) as Record<string, unknown>;
      const providers = (root.provider ?? {}) as Record<string, unknown>;
      const installed = providerMatches(providers.cursorapi as Record<string, unknown>, url);
      return {
        id,
        installed,
        configPath,
        detail: installed ? "Composer models installed" : "Ready to install",
        canInstall: true
      };
    }
    case "codex": {
      const configPath = path.join(homeDir(), ".codex", "config.toml");
      if (!fs.existsSync(configPath)) {
        return { id, installed: false, configPath, detail: "Codex config not found", canInstall: true };
      }
      const text = readText(configPath);
      const installed =
        text.includes("[model_providers.cursorapi]") &&
        text.includes(`base_url = "${url}"`) &&
        text.includes('wire_api = "responses"');
      return {
        id,
        installed,
        configPath,
        detail: installed ? "Custom provider installed" : "Ready to install",
        canInstall: true
      };
    }
    case "vscode": {
      const candidates = vscodeLanguageModelPaths();
      const match = candidates.find((p) => vscodeMatches(p, url));
      if (match) {
        return { id, installed: true, configPath: match, detail: "Model metadata installed", canInstall: true };
      }
      const configPath = candidates[0] ?? path.join(appDataDir("Code"), "User", "chatLanguageModels.json");
      return {
        id,
        installed: false,
        configPath,
        detail: fs.existsSync(configPath) ? "Provider needs update" : "VS Code chatLanguageModels.json not found",
        canInstall: true
      };
    }
    case "cline": {
      const configPath = path.join(homeDir(), ".cline", "data", "globalState.json");
      if (!fs.existsSync(configPath)) {
        return { id, installed: false, configPath, detail: "Cline globalState not found", canInstall: true };
      }
      const state = readJson(configPath, {}) as Record<string, unknown>;
      const secretsPath = path.join(homeDir(), ".cline", "data", "secrets.json");
      const installed =
        state.actModeApiProvider === "openai" &&
        state.planModeApiProvider === "openai" &&
        state.openAiBaseUrl === url &&
        state.actModeOpenAiModelId === "composer-2.5" &&
        state.planModeOpenAiModelId === "composer-2.5-fast" &&
        jsonFileContains(secretsPath, "cursor-local");
      return {
        id,
        installed,
        configPath,
        detail: installed ? "Provider profile installed" : "Ready to install",
        canInstall: true
      };
    }
    case "kilo": {
      const configPath = path.join(configHome(), "kilo", "kilo.jsonc");
      if (!fs.existsSync(configPath)) {
        return { id, installed: false, configPath, detail: "Kilo config not found", canInstall: true };
      }
      const root = parseJsonc(readText(configPath), {}) as Record<string, unknown>;
      const providers = (root.provider ?? {}) as Record<string, unknown>;
      const installed = providerMatches(providers.cursorapi as Record<string, unknown>, url);
      return {
        id,
        installed,
        configPath,
        detail: installed ? "Provider profile installed" : "Ready to install",
        canInstall: true
      };
    }
    case "pi": {
      const configPath = path.join(homeDir(), ".pi", "agent", "models.json");
      if (!fs.existsSync(configPath)) {
        return { id, installed: false, configPath, detail: "pi models.json not found", canInstall: true };
      }
      const root = readJson(configPath, {}) as Record<string, unknown>;
      const providers = (root.providers ?? {}) as Record<string, unknown>;
      const provider = providers.cursorapi as Record<string, unknown> | undefined;
      const installed =
        provider?.baseUrl === url &&
        provider?.apiKey === "cursor-local" &&
        MODELS.every((m) => Array.isArray(provider?.models) && JSON.stringify(provider.models).includes(m));
      return {
        id,
        installed,
        configPath,
        detail: installed ? "Custom models installed" : "Ready to install",
        canInstall: true
      };
    }
  }
}

function providerMatches(provider: Record<string, unknown> | undefined, url: string): boolean {
  if (!provider) return false;
  const options = (provider.options ?? provider) as Record<string, unknown>;
  return options.baseURL === url || options.baseUrl === url;
}

function vscodeLanguageModelPaths(): string[] {
  return ["Code", "Code - Insiders", "Cursor", "Windsurf", "VSCodium"].map((name) =>
    path.join(appDataDir(name), "User", "chatLanguageModels.json")
  );
}

function vscodeMatches(filePath: string, url: string): boolean {
  if (!fs.existsSync(filePath)) return false;
  const list = readJson(filePath, []) as unknown[];
  if (!Array.isArray(list)) return false;
  return list.some((item) => {
    const record = item as Record<string, unknown>;
    return (
      record.name === BRAND &&
      record.provider === "openai-compatible" &&
      record.baseUrl === url &&
      Array.isArray(record.models) &&
      MODELS.every((m) => (record.models as string[]).includes(m))
    );
  });
}

function installOpenCode(url: string): void {
  const configPath = path.join(configHome(), "opencode", "opencode.json");
  const root = (readJson(configPath, {}) as Record<string, unknown>) ?? {};
  const provider = (root.provider as Record<string, unknown>) ?? {};
  provider.cursorapi = {
    npm: "@ai-sdk/openai-compatible",
    name: BRAND,
    options: { baseURL: url, apiKey: "cursor-local" },
    models: Object.fromEntries(
      MODELS.map((id) => [
        id,
        {
          name: id === "composer-2.5" ? "Cursor Composer 2.5" : "Cursor Composer 2.5 Fast",
          cost: { input: id === "composer-2.5" ? 0.5 : 3, output: id === "composer-2.5" ? 2.5 : 15 },
          limit: { context: 200000, output: 65536 }
        }
      ])
    )
  };
  root.provider = provider;
  if (!root.model) root.model = "cursorapi/composer-2.5-fast";
  writeJson(configPath, root);
}

function replaceTomlBlock(text: string, sectionName: string, replacement: string): string {
  const escaped = sectionName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`(?ms)^\\[${escaped}\\]\\n.*?(?=^\\[|\\z)`);
  const trimmedReplacement = replacement.trim();
  const next = text.replace(pattern, trimmedReplacement ? `${trimmedReplacement}\n` : "");
  return next.replace(/\n{3,}/g, "\n\n").trim();
}

function installCodex(url: string): void {
  const configPath = path.join(homeDir(), ".codex", "config.toml");
  let text = readText(configPath);
  const authCommand = process.platform === "win32" ? 'command = "cmd"' : 'command = "/bin/echo"';
  const authArgs =
    process.platform === "win32" ? 'args = ["/c", "echo", "cursor-local"]' : 'args = ["cursor-local"]';
  const providerBlock = `[model_providers.cursorapi]
name = "${BRAND}"
base_url = "${url}"
wire_api = "responses"`;
  const authBlock = `[model_providers.cursorapi.auth]
${authCommand}
${authArgs}
refresh_interval_ms = 300000`;
  text = replaceTomlBlock(text, "model_providers.cursorapi.auth", "");
  text = replaceTomlBlock(text, "model_providers.cursorapi", "");
  text = replaceTomlBlock(text, "profiles.cursorapi", "");
  text = replaceTomlBlock(text, "profiles.cursorapi-fast", "");
  text = text.trim();
  if (text) text += "\n\n";
  text += `${providerBlock}\n\n${authBlock}\n`;
  writeText(configPath, text);
  for (const profile of [
    { name: "cursorapi", model: "composer-2.5" },
    { name: "cursorapi-fast", model: "composer-2.5-fast" }
  ]) {
    writeText(
      path.join(homeDir(), ".codex", `${profile.name}.config.toml`),
      `model_provider = "cursorapi"\nmodel = "${profile.model}"\n`
    );
  }
}

function installVSCode(url: string): void {
  const configPath = vscodeLanguageModelPaths().find((p) => fs.existsSync(path.dirname(p))) ??
    path.join(appDataDir("Code"), "User", "chatLanguageModels.json");
  const list = (readJson(configPath, []) as unknown[]) ?? [];
  const filtered = Array.isArray(list)
    ? list.filter((item) => (item as Record<string, unknown>).name !== BRAND)
    : [];
  filtered.push({
    name: BRAND,
    provider: "openai-compatible",
    baseUrl: url,
    models: [...MODELS]
  });
  writeJson(configPath, filtered);
}

function clineModelInfo(modelId: string): Record<string, unknown> {
  const limits =
    modelId === "composer-2.5-fast"
      ? { output: 65536, context: 200000, input: 3, outputPrice: 15 }
      : { output: 65536, context: 200000, input: 0.5, outputPrice: 2.5 };
  return {
    maxTokens: limits.output,
    contextWindow: limits.context,
    supportsImages: true,
    supportsPromptCache: false,
    inputPrice: limits.input,
    outputPrice: limits.outputPrice,
    temperature: 0,
    supportsTools: true,
    supportsStreaming: true,
    systemRole: "system"
  };
}

function jsonFileContains(filePath: string, needle: string): boolean {
  if (!fs.existsSync(filePath) || !needle) return false;
  return readText(filePath).includes(needle);
}

function installCline(url: string): void {
  const globalPath = path.join(homeDir(), ".cline", "data", "globalState.json");
  const secretsPath = path.join(homeDir(), ".cline", "data", "secrets.json");
  const globalState = (readJson(globalPath, {}) as Record<string, unknown>) ?? {};
  globalState.actModeApiProvider = "openai";
  globalState.planModeApiProvider = "openai";
  globalState.actModeOpenAiModelId = "composer-2.5";
  globalState.planModeOpenAiModelId = "composer-2.5-fast";
  globalState.actModeOpenAiModelInfo = clineModelInfo("composer-2.5");
  globalState.planModeOpenAiModelInfo = clineModelInfo("composer-2.5-fast");
  globalState.openAiBaseUrl = url;
  globalState.openAiHeaders = {};
  globalState.welcomeViewCompleted = true;
  if (globalState.remoteRulesToggles === undefined) globalState.remoteRulesToggles = {};
  if (globalState.remoteWorkflowToggles === undefined) globalState.remoteWorkflowToggles = {};
  writeJson(globalPath, globalState);
  const secrets = (readJson(secretsPath, {}) as Record<string, unknown>) ?? {};
  secrets.openAiApiKey = "cursor-local";
  writeJson(secretsPath, secrets);
}

function installKilo(url: string): void {
  const configPath = path.join(configHome(), "kilo", "kilo.jsonc");
  const root = (parseJsonc(readText(configPath), {
    $schema: "https://app.kilo.ai/config.json"
  }) as Record<string, unknown>) ?? {};
  const provider = (root.provider as Record<string, unknown>) ?? {};
  provider.cursorapi = {
    options: { baseURL: url, apiKey: "cursor-local" },
    models: {
      "composer-2.5": { name: "Cursor Composer 2.5" },
      "composer-2.5-fast": { name: "Cursor Composer 2.5 Fast" }
    }
  };
  root.provider = provider;
  if (!root.model) root.model = "cursorapi/composer-2.5";
  const text = `${JSON.stringify(root, null, 2)}\n`;
  fs.mkdirSync(path.dirname(configPath), { recursive: true });
  backupIfChanged(configPath, text);
  fs.writeFileSync(configPath, text, "utf8");
}

function installPi(url: string): void {
  const configPath = path.join(homeDir(), ".pi", "agent", "models.json");
  const root = (readJson(configPath, { providers: {} }) as Record<string, unknown>) ?? {};
  const providers = (root.providers as Record<string, unknown>) ?? {};
  providers.cursorapi = {
    baseUrl: url,
    apiKey: "cursor-local",
    authHeader: true,
    api: "openai-completions",
    models: MODELS.map((id) => ({
      id,
      name: id,
      api: "openai-completions",
      reasoning: false,
      input: ["text"],
      contextWindow: 200000,
      maxTokens: 65536
    }))
  };
  root.providers = providers;
  writeJson(configPath, root);
}

function stripJsonComments(text: string): string {
  return text.replace(/\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");
}

function parseJsonc(text: string, fallback: unknown): unknown {
  const trimmed = text.trim();
  if (!trimmed) return fallback;
  try {
    return JSON.parse(stripJsonComments(trimmed));
  } catch {
    return fallback;
  }
}
