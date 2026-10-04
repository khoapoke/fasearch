import { it } from "node:test";
import assert from "node:assert/strict";
import { proxyCatalogGet } from "../src/lib/catalog-proxy.ts";

it("rejects unsafe trace without fetching or reflecting it", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () => { throw new Error("fetch must not run"); };
  try {
    const response = await proxyCatalogGet(new Request("http://local/api/catalog/products", {
      headers: {"X-Trace-Id":"unsafe<probe>"},
    }), "http://backend", "/api/v1/catalog/products");
    assert.equal(response.status,400);
    const body = await response.json();
    assert.equal(body.code,"INVALID_REQUEST");
    assert.notEqual(body.trace_id,"unsafe<probe>");
    assert.match(body.trace_id,/^[A-Za-z0-9._:-]{1,128}$/);
    assert.equal(response.headers.get("x-trace-id"),body.trace_id);
    assert.equal(response.headers.get("cache-control"),"no-store");
  } finally { globalThis.fetch = original; }
});

it("connection refusal preserves only a valid trace in typed no-store error", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () => { throw new Error("secret backend address"); };
  try {
    const response = await proxyCatalogGet(new Request("http://local/api/catalog/products", {
      headers:{"X-Trace-Id":"safe-trace"},
    }),"http://backend","/api/v1/catalog/products");
    assert.equal(response.status,502);
    const body = await response.json();
    assert.equal(body.trace_id,"safe-trace");
    assert.equal(body.code,"BACKEND_UNAVAILABLE");
    assert.equal(JSON.stringify(body).includes("secret"),false);
  } finally { globalThis.fetch = original; }
});

it("forwards exact query and sanitizes an invalid upstream trace header", async () => {
  const original = globalThis.fetch;
  let target;
  globalThis.fetch = async (url) => {
    target=url;
    return Response.json({items:[]},{headers:{"X-Trace-Id":"unsafe<upstream>"}});
  };
  try {
    const response = await proxyCatalogGet(new Request("http://local/api/catalog/products?size=60&size=20",{
      headers:{"X-Trace-Id":"safe-trace"},
    }),"http://backend","/api/v1/catalog/products");
    assert.equal(target,"http://backend/api/v1/catalog/products?size=60&size=20");
    assert.equal(response.headers.get("X-Trace-Id"),"safe-trace");
    assert.equal(response.headers.get("cache-control"),"no-store");
  } finally { globalThis.fetch = original; }
});
