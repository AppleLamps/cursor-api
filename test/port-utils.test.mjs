import assert from "node:assert/strict";
import http from "node:http";
import { after, describe, it } from "node:test";
import { isAddrInUse, listenWithPortRetry, pickPort } from "../dist/port-utils.js";

describe("port-utils", () => {
  it("detects EADDRINUSE", () => {
    const err = Object.assign(new Error("bind"), { code: "EADDRINUSE" });
    assert.equal(isAddrInUse(err), true);
    assert.equal(isAddrInUse(new Error("other")), false);
  });

  it("pickPort skips excluded ports", async () => {
    const port = await pickPort("127.0.0.1", 49152, 8, new Set([49152, 49153]));
    assert.ok(port >= 49154);
  });

  it("listenWithPortRetry binds on the next port when preferred is taken", async () => {
    const blocker = http.createServer();
    const preferred = await new Promise((resolve, reject) => {
      blocker.once("error", reject);
      blocker.listen(0, "127.0.0.1", () => {
        const addr = blocker.address();
        resolve(typeof addr === "object" && addr ? addr.port : 0);
      });
    });

    const server = http.createServer((_req, res) => {
      res.writeHead(200);
      res.end("ok");
    });

    try {
      const bound = await listenWithPortRetry(server, "127.0.0.1", preferred, new Set(), 4);
      assert.equal(bound, preferred + 1);
    } finally {
      await new Promise((resolve) => server.close(() => resolve()));
      await new Promise((resolve) => blocker.close(() => resolve()));
    }
  });
});
