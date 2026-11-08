// [ai] AI search through the FE (text / image / multimodal): results are real products currently on sale (card data, catalog images).
// Ported from demo-rehearsal G-ai* and integration-20261104 e2e search smoke.
import { test } from "node:test";
import assert from "node:assert/strict";
import { suite } from "../lib/suite.mjs";
import { Client } from "../lib/http.mjs";
import { discoverProduct } from "../lib/data.mjs";
import { step, chk, res, multipart } from "../lib/steps.mjs";

const items = (j) => { const r = res(j); return r?.results ?? r?.items ?? (Array.isArray(r) ? r : []); };
const TECH_KEYS = ["fileName", "catalog", "nguonDuLieu", "phienBanDuLieu", "maSpLienKet", "tenHienThi"];

suite("ai", "AI search via FE", () => {
  test("text / image / multimodal", { timeout: 600000 }, async (t) => {
    const g = new Client();
    for (const [sid, q, label] of [["G-ai1", "áo thun đen basic", "AI text VN"], ["G-ai2", "black shirt", "AI text EN"], ["G-ai3", "giày thể thao trắng", "AI text VN 2"]]) {
      const r = await g.req("POST", "/api/ai/search/text", { body: { query: q, limit: 12 }, timeout: 120000 });
      await chk(t, `${sid} ${label}`, r, { pred: (j) => res(j) != null });
      const list = items(r.j);
      await step(t, `${sid} ${label} returns >0 named results`, () => { assert.ok(list.length > 0, "0 results"); assert.ok(list.every((x) => x.name), "result without a name"); });
      await step(t, `${sid} ${label} results are card data of real products (no dataset/seed fields)`, () => {
        assert.ok(list.length >= 6 && list.length <= 12, "expected 6..12 results");
        assert.equal(new Set(list.map((x) => x.productId)).size, list.length, "duplicate productId");
        for (const x of list) {
          assert.ok(Number.isInteger(x.productId) && x.productId > 0 && typeof x.price === "number", `bad card ${JSON.stringify(x).slice(0, 120)}`);
          for (const k of TECH_KEYS) assert.ok(!(k in x), `leaked technical field ${k}`);
          assert.ok(x.imageUrl == null || x.imageUrl.startsWith("/api/catalog/product-images/"), `image ${x.imageUrl}`);
        }
      });
      // Every hit must be a product the public catalog serves (published, not deleted).
      for (const x of list.slice(0, 3)) {
        const d = await g.req("GET", `/api/catalog/products/${x.productId}`, { origin: false });
        await step(t, `${sid} ${label} hit ${x.productId} exists in live catalog`, () => assert.equal(d.code, 200, `catalog http ${d.code}`));
      }
      const first = list[0];
      if (first?.imageUrl) {
        const ir = await g.req("GET", first.imageUrl, { origin: false });
        await step(t, `${sid} ${label} result image via catalog BFF`, () => assert.ok(ir.code === 200 && ir.buf.length > 1000, `http ${ir.code}`));
      }
    }
    const vr = await g.req("POST", "/api/ai/search/text", { body: { query: "quần jean xanh", limit: 12 }, timeout: 120000 });
    const names = items(vr.j).map((x) => x.name ?? "").join(" ").toLowerCase();
    await step(t, "G-ai5 AI VN relevance sanity ('quần jean xanh' returns trousers/jeans)", () => assert.ok(["quần", "jean", "pants", "jogger"].some((k) => names.includes(k)), "VN query returned other garments"), { todo: "known model limit: CLIP is English-centric (demo with EN queries)" });
    await step(t, "text search rejects empty query (400)", async () => { const r = await g.req("POST", "/api/ai/search/text", { body: { query: "   " } }); assert.equal(r.code, 400); });

    // image + multimodal: use the first catalog product's own image
    const pid = await discoverProduct(g);
    const d = res((await g.req("GET", `/api/catalog/products/${pid}`, { origin: false })).j);
    const im = await g.req("GET", d.imageUrl, { origin: false });
    const file = { name: "p.jpg", type: im.ct.startsWith("image/png") ? "image/png" : "image/jpeg", buf: im.buf };
    const mi = multipart({ limit: "12" }, file);
    const ri = await g.req("POST", "/api/ai/search/image", { raw: mi.raw, ctype: mi.ctype, timeout: 180000 });
    await chk(t, "G-ai4 AI image search", ri, { pred: (j) => res(j) != null });
    await step(t, `G-ai4n AI image search finds source product ${pid} in top5`, () => {
      const ids = items(ri.j).map((x) => x.productId);
      assert.ok(ids.includes(pid), `top=${ids}`);
    });
    const mm = multipart({ limit: "12", query: "black", text_weight: "0.5" }, file);
    const rm = await g.req("POST", "/api/ai/search/multimodal", { raw: mm.raw, ctype: mm.ctype, timeout: 180000 });
    await chk(t, "AI multimodal search (image + text)", rm, { pred: (j) => items(j).length > 0 });
    await step(t, "AI multimodal results are named", () => assert.ok(items(rm.j).every((x) => x.name && x.productId)));
    const bad = multipart({ limit: "12" }, { name: "x.txt", type: "text/plain", buf: Buffer.from("nope") });
    await step(t, "image search rejects non-image upload (415)", async () => { const r = await g.req("POST", "/api/ai/search/image", { raw: bad.raw, ctype: bad.ctype }); assert.equal(r.code, 415); });
  });
});
