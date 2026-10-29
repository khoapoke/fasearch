// Contract smoke: FE catalog proxy -> pinned BE 18097 -> candidate Pg DB.
// Read-only GETs; no auth/token, no writes. Usage: node scripts/catalog-api-check.mjs <feBase> <outDir>

import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const [base, outDir] = process.argv.slice(2);
if (!base || !outDir) {
  console.error("dùng: node scripts/catalog-api-check.mjs <feBase> <outDir>");
  process.exit(1);
}
await mkdir(outDir, { recursive: true });
const results = [];
const record = (name, ok, detail) => {
  results.push({ name, ok, detail });
  console.log(`${ok ? "OK  " : "FAIL"} ${name}${detail ? " — " + detail : ""}`);
};

async function get(path) {
  const response = await fetch(`${base}${path}`, { cache: "no-store" });
  let json = null;
  try { json = await response.json(); } catch { /* non json */ }
  return { response, json };
}

const cats = await get("/api/catalog/categories");
record("categories: envelope + 4 danh mục BE thật", cats.response.ok && cats.json?.success === true && Array.isArray(cats.json.result) && cats.json.result.length >= 4, JSON.stringify(cats.json?.result));
const categories = cats.json?.result ?? [];
const jacket = categories.find((c) => c.categoryName === "Áo Khoác");

const page0 = await get("/api/catalog/products?page=0&size=6&sort=id,desc");
const p0 = page0.json?.result;
record("products: PageResponse thật (12 items, 2 trang, field names)", page0.response.ok && p0?.totalElements === 12 && p0?.totalPages === 2 && p0?.content?.length === 6 && p0?.content.every((x) => x.id && x.productName && typeof x.price === "number"), JSON.stringify({ total: p0?.totalElements, pages: p0?.totalPages, items: p0?.content?.length }));

const page1 = await get("/api/catalog/products?page=1&size=6&sort=id,desc");
record("products: page 1 trả 6 item khác trang 0", page1.response.ok && page1.json?.result?.content?.length === 6 && page1.json.result.content[0]?.id !== p0?.content?.[0]?.id, JSON.stringify({ first: page1.json?.result?.content?.[0]?.id }));

const byCat = await get(`/api/catalog/products?categoryId=${jacket?.id}&page=0&size=20&sort=id,desc`);
record("filter category thật trên server (Áo Khoác)", byCat.response.ok && byCat.json?.result?.totalElements === 2 && byCat.json.result.content.every((x) => x.categoryId === jacket.id), JSON.stringify(byCat.json?.result?.content?.map((x) => x.productName)));

const byPrice = await get("/api/catalog/products?minPrice=300000&maxPrice=500000&page=0&size=20&sort=price,asc");
record("filter khoảng giá thật trên server", byPrice.response.ok && byPrice.json?.result?.totalElements === 4 && byPrice.json.result.content.every((x) => x.price >= 300000 && x.price <= 500000), JSON.stringify(byPrice.json?.result?.content?.map((x) => x.price)));

const keyword = await get(`/api/catalog/products?keyword=${encodeURIComponent("áo")}&page=0&size=20&sort=id,desc`);
record("keyword thật trên server (áo)", keyword.response.ok && keyword.json?.result?.content?.length >= 5 && keyword.json.result.content.every((x) => x.productName.toLowerCase().includes("áo")), JSON.stringify(keyword.json?.result?.content?.map((x) => x.productName)));

const sorted = await get("/api/catalog/products?page=0&size=6&sort=price,asc");
record("sort giá tăng thật trên server", sorted.response.ok && sorted.json?.result?.content?.[0]?.price === 150000, JSON.stringify(sorted.json?.result?.content?.map((x) => x.price)));

const detailId = p0?.content?.[0]?.id;
const detail = await get(`/api/catalog/products/${detailId}`);
const d = detail.json?.result;
record("detail: real product + image + variants + additionalPrice", detail.response.ok && d?.id === detailId && typeof d?.price === "number" && Array.isArray(d?.variants) && d.variants.length > 0 && typeof d.variants[0].additionalPrice === "number" && (d.imageUrl === null || /^https?:\/\//.test(d.imageUrl)), JSON.stringify({ id: d?.id, name: d?.productName, price: d?.price, variants: d?.variants?.length, image: d?.imageUrl?.slice(0, 60) }));

const missing = await get("/api/catalog/products/999999");
record("detail 404 thật từ BE được giữ nguyên", missing.response.status === 404 && missing.json?.success === false && missing.json?.code === 404, JSON.stringify(missing.json));

const bad = await get("/api/catalog/products/not-a-number");
record("proxy từ chối id không hợp lệ (400, không gọi bừa)", bad.response.status === 400 && bad.json?.success === false, JSON.stringify(bad.json));

const direct = await fetch("http://127.0.0.1:18097/api/v1/products?page=0&size=6&sort=id,desc&status=ACTIVE", { cache: "no-store" });
const directJson = await direct.json();
record("so khớp direct BE ↔ proxy (cùng IDs/giá/tổng)", direct.ok && directJson.result.totalElements === p0?.totalElements && directJson.result.content[0]?.id === p0?.content?.[0]?.id && Number(directJson.result.content[0]?.price) === p0?.content?.[0]?.price, JSON.stringify({ direct: directJson.result.content[0]?.id, proxy: p0?.content?.[0]?.id }));

await writeFile(join(outDir, "catalog-api-report.json"), JSON.stringify(results, null, 2));
const failed = results.filter((x) => !x.ok);
console.log(`\n${results.length - failed.length}/${results.length} pass`);
process.exit(failed.length === 0 ? 0 : 1);
