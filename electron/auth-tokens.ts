/** Placeholder Bearer tokens rewritten to the user's Cursor API key (macOS parity). */
const PLACEHOLDER_TOKENS = new Set([
  "cursor-local",
  "cursor_api_key",
  "cursor-api-key",
  "{env:cursor_api_key}",
  "{env:cursor-api-key}"
]);

export function isPlaceholderToken(token: string | undefined): boolean {
  if (!token) return false;
  const normalized = token.trim().toLowerCase();
  return PLACEHOLDER_TOKENS.has(normalized);
}
