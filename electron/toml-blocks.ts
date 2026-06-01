/** Replace a TOML [section] block (through next section or EOF). Used by Codex install. */
export function replaceTomlBlock(text: string, sectionName: string, replacement: string): string {
  const escaped = sectionName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`^\\[${escaped}\\]\\n[\\s\\S]*?(?=^\\[|$(?![\\s\\S]))`, "m");
  const trimmedReplacement = replacement.trim();
  const next = text.replace(pattern, trimmedReplacement ? `${trimmedReplacement}\n` : "");
  return next.replace(/\n{3,}/g, "\n\n").trim();
}
