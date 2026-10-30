import assert from "node:assert/strict";
import test from "node:test";
import { readBoundedJsonObject } from "../src/lib/server/bounded-json.ts";

const req = (body, headers = {}) => new Request("http://localhost/api", { method: "POST", body, headers });

test("bounded JSON accepts a plain object and rejects malformed/non-object bodies", async () => {
  assert.deepEqual(await readBoundedJsonObject(req('{"code":"SAVE"}'), 64), { ok: true, body: { code: "SAVE" } });
  for (const body of ["{", "null", "[]", "true"]) {
    assert.deepEqual(await readBoundedJsonObject(req(body), 64), { ok: false, reason: "INVALID" });
  }
});

test("bounded JSON enforces actual UTF-8 byte length despite a misleading Content-Length", async () => {
  const body = JSON.stringify({ code: "é" });
  assert.ok(Buffer.byteLength(body) > 5);
  assert.deepEqual(await readBoundedJsonObject(req(body, { "content-length": "1" }), 5), { ok: false, reason: "TOO_LARGE" });
  assert.deepEqual(await readBoundedJsonObject(req("{}", { "content-length": "100" }), 5), { ok: false, reason: "TOO_LARGE" });
});
