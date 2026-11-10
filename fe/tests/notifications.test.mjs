import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";
const source = fs.readFileSync(new URL("../src/lib/notification-client.ts", import.meta.url), "utf8");
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const { notificationApi } = await import(`data:text/javascript;base64,${Buffer.from(js).toString("base64")}`);
test("notification transport preserves server rejection", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () => Response.json({ success: false, message: "Không có quyền" }, { status: 403 });
  try { await assert.rejects(notificationApi("/api/admin/notifications"), /Không có quyền/); }
  finally { globalThis.fetch = original; }
});
test("preference sends same-origin JSON with the requested boolean", async () => {
  const original = globalThis.fetch;
  let sent;
  globalThis.fetch = async (url, init) => { sent = { url, ...init }; return Response.json({ success: true, result: { orderUpdates: false } }); };
  try {
    assert.deepEqual(await notificationApi("/api/customer-account/notifications/preferences", { orderUpdates: false }), { orderUpdates: false });
    assert.equal(sent.method, "PUT"); assert.equal(sent.cache, "no-store"); assert.equal(sent.body, '{"orderUpdates":false}');
  } finally { globalThis.fetch = original; }
});
test("marking an event read uses POST and its event endpoint", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async (url, init) => { assert.equal(url, "/api/admin/notifications/42/read"); assert.equal(init.method, "POST"); return Response.json({ success: true, result: { read: true } }); };
  try { assert.deepEqual(await notificationApi("/api/admin/notifications/42/read", {}, "POST"), { read: true }); }
  finally { globalThis.fetch = original; }
});
