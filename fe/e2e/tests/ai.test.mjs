// [ai] AI search through the FE (text / image / multimodal) with named results and image bytes.
// Ported from demo-rehearsal G-ai* and integration-20261104 e2e search smoke.
import { test } from "node:test";
import assert from "node:assert/strict";
import { suite } from "../lib/suite.mjs";
import { Client } from "../lib/http.mjs";
import { discoverProduct } from "../lib/data.mjs";
import { step, chk, res, multipart } from "../lib/steps.mjs";

const items = (j) => { const r = res(j); return r?.results ?? r?.items ?? (Array.isArray(r) ? r : []); };

suite("ai", "AI search via FE", () => {
  test("text / image / multimodal", { timeout: 600000 }, async (t) => {
    const g = new Client();
    for (const [sid, q, label] of [["G-ai1", "áo thun đen basic", "AI text VN"], ["G-ai2", "black shirt", "AI text EN"], ["G-ai3", "giày thể thao trắng", "AI text VN 2"]]) {
      const r = await g.req("POST", "/api/ai/search/text", { body: { query: q, limit: 5 }, timeout: 120000 });
      await chk(t, `${sid} ${label}`, r, { pred: (j) => res(j) != null });
      const list = items(r.j);
      await step(t, `${sid} ${label} returns >0 named results`, () => { assert.ok(list.length > 0, "0 results"); assert.ok(list.every((x) => x.tenHienThi || x.productName || x.name), "result without a name"); });
      const first = list[0]; const ip = first?.imageUrl;
      if (ip && ip.startsWith("/api/ai/image")) {
        const ir = await g.req("GET", ip, { origin: false });
        await step(t, `${sid} ${label} result image via /api/ai/image`, () => assert.ok(ir.code === 200 && ir.buf.length > 1000, `http ${ir.code}`));
      }
    }
    const vr = await g.req("POST", "/api/ai/search/text", { body: { query: "quần jean xanh", limit: 5 }, timeout: 120000 });
    const names = items(vr.j).map((x) => x.tenHienThi ?? x.productName ?? "").join(" ").toLowerCase();
    await step(t, "G-ai5 AI VN relevance sanity ('quần jean xanh' returns trousers/jeans)", () => assert.ok(["quần", "jean", "pants", "jogger"].some((k) => names.includes(k)), "VN query returned other garments"), { todo: "known model limit: CLIP is English-centric (demo with EN queries)" });
    await step(t, "text search rejects empty query (400)", async () => { const r = await g.req("POST", "/api/ai/search/text", { body: { query: "   " } }); assert.equal(r.code, 400); });

    // image + multimodal: use the first catalog product's own image
    const pid = await discoverProduct(g);
    const d = res((await g.req("GET", `/api/catalog/products/${pid}`, { origin: false })).j);
    const im = await g.req("GET", d.imageUrl, { origin: false });
    const file = { name: "p.jpg", type: im.ct.startsWith("image/png") ? "image/png" : "image/jpeg", buf: im.buf };
    const mi = multipart({ limit: "5" }, file);
    const ri = await g.req("POST", "/api/ai/search/image", { raw: mi.raw, ctype: mi.ctype, timeout: 180000 });
    await chk(t, "G-ai4 AI image search", ri, { pred: (j) => res(j) != null });
    await step(t, `G-ai4n AI image search finds source product ${pid} in top5`, () => {
      const ids = items(ri.j).map((x) => x.maSpLienKet ?? x.productId);
      assert.ok(ids.includes(pid), `top=${ids}`);
    });
    const mm = multipart({ limit: "5", query: "black", text_weight: "0.5" }, file);
    const rm = await g.req("POST", "/api/ai/search/multimodal", { raw: mm.raw, ctype: mm.ctype, timeout: 180000 });
    await chk(t, "AI multimodal search (image + text)", rm, { pred: (j) => items(j).length > 0 });
    await step(t, "AI multimodal results are named", () => assert.ok(items(rm.j).every((x) => x.tenHienThi || x.productName || x.name)));
    const bad = multipart({ limit: "5" }, { name: "x.txt", type: "text/plain", buf: Buffer.from("nope") });
    await step(t, "image search rejects non-image upload (415)", async () => { const r = await g.req("POST", "/api/ai/search/image", { raw: bad.raw, ctype: bad.ctype }); assert.equal(r.code, 415); });
  });
});
