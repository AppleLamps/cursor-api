import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { replaceTomlBlock } from "../dist/toml-blocks.js";

describe("replaceTomlBlock", () => {
  it("replaces a section in the middle of the file", () => {
    const input = `[alpha]
x = 1

[model_providers.cursorapi]
old = true

[beta]
y = 2
`;
    const out = replaceTomlBlock(input, "model_providers.cursorapi", "[model_providers.cursorapi]\nnew = true");
    assert.ok(out.includes("new = true"));
    assert.ok(!out.includes("old = true"));
    assert.ok(out.includes("[alpha]"));
    assert.ok(out.includes("[beta]"));
  });

  it("replaces a section at end of file", () => {
    const input = `[other]
a = 1

[model_providers.cursorapi]
stale = 1
`;
    const out = replaceTomlBlock(input, "model_providers.cursorapi", "[model_providers.cursorapi]\nfresh = 2");
    assert.ok(out.includes("fresh = 2"));
    assert.ok(!out.includes("stale = 1"));
  });

  it("constructs a valid RegExp (no Invalid group)", () => {
    assert.doesNotThrow(() => replaceTomlBlock("[x]\n1\n", "model_providers.cursorapi", ""));
  });
});
