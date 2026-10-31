// F3: proxy session-only — Authorization của client không bao giờ lên upstream,
// trong khi session/CSRF/content-type/multipart/status giữ nguyên.
// Run: node --test tests/be-headers.test.mjs   (from the fe/ directory)

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildUpstreamHeaders } from "../src/lib/server/be-headers.ts";

function incoming(entries) {
  const headers = new Headers();
  for (const [key, value] of entries) headers.set(key, value);
  return headers;
}

describe("buildUpstreamHeaders (F3)", () => {
  it("loại Authorization mọi biến thể hoa/thường", () => {
    const out = buildUpstreamHeaders(
      incoming([
        ["Authorization", "Bearer secret-token"],
        ["authorization", "Basic abc"],
      ]),
      "sess-123",
    );
    assert.equal(out.get("authorization"), null);
    assert.ok(![...out.keys()].some((k) => k.toLowerCase() === "authorization"));
  });

  it("dựng lại duy nhất FASEARCH_SESSION từ cookie, bỏ cookie gốc", () => {
    const out = buildUpstreamHeaders(
      incoming([["cookie", "FASEARCH_SESSION=sess-123; other=evil; tracking=1"]]),
      "sess-123",
    );
    assert.equal(out.get("cookie"), "FASEARCH_SESSION=sess-123");
  });

  it("không đặt cookie khi chưa login", () => {
    const out = buildUpstreamHeaders(incoming([]), undefined);
    assert.equal(out.get("cookie"), null);
  });

  it("giữ CSRF, content-type (kể cả multipart boundary) và header thường", () => {
    const out = buildUpstreamHeaders(
      incoming([
        ["x-csrf-token", "csrf-abc"],
        ["content-type", "multipart/form-data; boundary=----xyz"],
        ["x-custom", "keep-me"],
      ]),
      "sess-123",
    );
    assert.equal(out.get("x-csrf-token"), "csrf-abc");
    assert.equal(out.get("content-type"), "multipart/form-data; boundary=----xyz");
    assert.equal(out.get("x-custom"), "keep-me");
  });

  it("loại hop-by-hop và content-length", () => {
    const out = buildUpstreamHeaders(
      incoming([
        ["connection", "keep-alive"],
        ["transfer-encoding", "chunked"],
        ["proxy-authorization", "Basic zap"],
        ["content-length", "42"],
        ["host", "evil.test"],
      ]),
      "sess-123",
    );
    for (const name of ["connection", "transfer-encoding", "proxy-authorization", "content-length", "host"]) {
      assert.equal(out.get(name), null);
    }
  });
});
