// Warehouse proxy parity + CSRF-gated writes.
// Run: node --test tests/wh-transport.test.mjs   (from the fe/ directory)

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildUpstreamHeaders } from "../src/lib/server/be-headers.ts";
import {
  parseBackendBase,
  whRequestHeaders,
  whResponseHeaders,
} from "../src/lib/server/wh-forward.ts";
import { whWrite } from "../src/lib/wh-client.ts";

describe("whRequestHeaders", () => {
  it("lược Accept-Language nhưng giữ session + CSRF", () => {
    const incoming = new Headers({
      "accept-language": "vi-VN,vi;q=0.9",
      "x-csrf-token": "tok",
    });
    const out = whRequestHeaders(buildUpstreamHeaders, incoming, "sess123");
    assert.equal(out.get("accept-language"), null);
    assert.equal(out.get("x-csrf-token"), "tok");
    assert.equal(out.get("cookie"), "FASEARCH_SESSION=sess123");
  });
});

describe("whResponseHeaders", () => {
  it("giữ content-type/set-cookie/location, bỏ hop-by-hop", () => {
    const kept = whResponseHeaders({
      "content-type": "application/json",
      "set-cookie": ["a=1; Path=/", "b=2; Path=/"],
      location: "/api/v1/kho/phieu/9",
      connection: "close",
      "content-length": "42",
    });
    assert.equal(kept.contentType, "application/json");
    assert.deepEqual(kept.cookies, ["a=1; Path=/", "b=2; Path=/"]);
    assert.equal(kept.location, "/api/v1/kho/phieu/9");
  });

  it("thiếu header vẫn an toàn (rỗng)", () => {
    const kept = whResponseHeaders({});
    assert.equal(kept.contentType, undefined);
    assert.deepEqual(kept.cookies, []);
    assert.equal(kept.location, undefined);
  });
});

describe("parseBackendBase", () => {
  it("http mặc định cổng 80, https 443, path bị bỏ", () => {
    assert.deepEqual(parseBackendBase("http://127.0.0.1:18084"), {
      protocol: "http:",
      host: "127.0.0.1",
      port: 18084,
    });
    assert.deepEqual(parseBackendBase("https://be.local/base/"), {
      protocol: "https:",
      host: "be.local",
      port: 443,
    });
  });

  it("scheme lạ bị từ chối", () => {
    assert.throws(() => parseBackendBase("ftp://x/"), /http\(s\)/);
  });
});

describe("whWrite CSRF gate", () => {
  it("csrf 401 → chặn write bằng 401, không gọi upstream", async () => {
    let upstreamHit = 0;
    globalThis.fetch = (async (url) => {
      if (url === "/api/auth/csrf") return new Response("{}", { status: 401 });
      upstreamHit += 1;
      return new Response("{}", { status: 200 });
    });
    try {
      const r = await whWrite("v1/kho/phieu/nhap", "POST", { a: 1 });
      assert.equal(r.status, 401);
      assert.equal(upstreamHit, 0);
      const body = await r.json();
      assert.equal(body.success, false);
    } finally {
      // @ts-expect-error restore
      delete globalThis.fetch;
    }
  });

  it("csrf 200 sai envelope → 502, không gọi upstream", async () => {
    let upstreamHit = 0;
    globalThis.fetch = (async (url) => {
      if (url === "/api/auth/csrf") {
        return new Response(JSON.stringify({ success: true, code: 200, result: { nope: 1 } }), { status: 200 });
      }
      upstreamHit += 1;
      return new Response("{}", { status: 200 });
    });
    try {
      const r = await whWrite("v1/kho/phieu/nhap", "POST", { a: 1 });
      assert.equal(r.status, 502);
      assert.equal(upstreamHit, 0);
    } finally {
      // @ts-expect-error restore
      delete globalThis.fetch;
    }
  });

  it("csrf hợp lệ → gửi kèm header CSRF đúng", async () => {
    let sent = {};
    globalThis.fetch = (async (url, init) => {
      if (url === "/api/auth/csrf") {
        return new Response(
          JSON.stringify({ success: true, code: 200, result: { headerName: "X-CSRF-TOKEN", token: "T" } }),
          { status: 200 },
        );
      }
      sent = { ...init?.headers };
      return new Response("{}", { status: 200 });
    });
    try {
      await whWrite("v1/kho/phieu/nhap", "POST", { a: 1 });
      assert.equal(sent["X-CSRF-TOKEN"], "T");
    } finally {
      // @ts-expect-error restore
      delete globalThis.fetch;
    }
  });
});
