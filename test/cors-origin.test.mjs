import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isAllowedOrigin } from "../dist/auth-proxy.js";

describe("isAllowedOrigin", () => {
  it("allows missing or null origin (CLI clients)", () => {
    assert.equal(isAllowedOrigin(undefined), true);
    assert.equal(isAllowedOrigin("null"), true);
  });

  it("allows localhost origins", () => {
    assert.equal(isAllowedOrigin("http://127.0.0.1:8787"), true);
    assert.equal(isAllowedOrigin("http://localhost:3000"), true);
    assert.equal(isAllowedOrigin("http://[::1]:8787"), true);
    assert.equal(isAllowedOrigin("file://"), true);
  });

  it("blocks remote web origins", () => {
    assert.equal(isAllowedOrigin("https://evil.example"), false);
    assert.equal(isAllowedOrigin("http://192.168.1.5"), false);
  });
});
