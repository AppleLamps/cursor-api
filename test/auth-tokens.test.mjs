import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isPlaceholderToken } from "../dist/auth-tokens.js";

describe("isPlaceholderToken", () => {
  it("accepts known placeholders", () => {
    assert.equal(isPlaceholderToken("cursor-local"), true);
    assert.equal(isPlaceholderToken("CURSOR-LOCAL"), true);
    assert.equal(isPlaceholderToken("cursor_api_key"), true);
    assert.equal(isPlaceholderToken("{env:cursor-api-key}"), true);
  });

  it("rejects real keys", () => {
    assert.equal(isPlaceholderToken("cr_live_abc"), false);
    assert.equal(isPlaceholderToken(""), false);
    assert.equal(isPlaceholderToken(undefined), false);
  });
});
