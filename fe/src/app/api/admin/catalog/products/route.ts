import type { NextRequest } from "next/server";
import { requireJsonPost, authError, readJsonObject } from "@/lib/server/customer-auth";
import { catalogRead, catalogWrite } from "@/lib/server/admin-catalog";
const STATUS = new Set(["DRAFT", "ACTIVE", "OUT_OF_STOCK", "DISCONTINUED"]);
export const dynamic = "force-dynamic"; export const runtime = "nodejs";
function query(request: NextRequest): URLSearchParams {
  const p = request.nextUrl.searchParams;
  const page = Number(p.get("page") ?? "0"); const size = Number(p.get("size") ?? "10");
  if (!Number.isInteger(page) || page < 0 || page > 10000) throw new Error("page");
  if (!Number.isInteger(size) || size < 1 || size > 50) throw new Error("size");
  const q = new URLSearchParams({ page: String(page), size: String(size), sort: "id,desc" });
  for (const key of ["keyword", "categoryId", "minPrice", "maxPrice", "status"]) { const v = p.get(key); if (v) q.set(key, v); }
  if ((q.get("keyword") ?? "").length > 100) throw new Error("keyword");
  if (q.get("status") && !STATUS.has(q.get("status")!)) throw new Error("status");
  return q;
}
export async function GET(request: NextRequest) {
  try { return await catalogRead(request, `/api/v1/products?${query(request)}`); }
  catch { return Response.json({ success: false, code: 400, message: "Bộ lọc sản phẩm chưa hợp lệ.", result: null }, { status: 400 }); }
}
export async function POST(request: NextRequest) {
  const guard = requireJsonPost(request); if (guard) return guard;
  const parsed = await readJsonObject(request); if (!parsed.ok) return parsed.response;
  const b = parsed.body;
  const name = typeof b.productName === "string" ? b.productName.trim() : "";
  const categoryId = typeof b.categoryId === "number" ? b.categoryId : 0;
  const price = typeof b.price === "number" ? b.price : NaN;
  const status = typeof b.status === "string" ? b.status : "ACTIVE";
  if (!name || name.length > 255) return authError("Tên sản phẩm phải từ 1 đến 255 ký tự.", 400);
  if (!Number.isSafeInteger(categoryId) || categoryId < 1) return authError("Danh mục chưa hợp lệ.", 400);
  if (!Number.isFinite(price) || price < 0) return authError("Giá bán phải là số không âm.", 400);
  if (!STATUS.has(status)) return authError("Trạng thái sản phẩm chưa hợp lệ.", 400);
  const body = { productName: name, categoryId, price, status,
    ...(typeof b.material === "string" ? { material: b.material.trim() } : {}),
    ...(typeof b.style === "string" ? { style: b.style.trim() } : {}),
    ...(typeof b.description === "string" ? { description: b.description } : {}),
    ...(typeof b.imageUrl === "string" ? { imageUrl: b.imageUrl.trim() } : {}) };
  return catalogWrite(request, "/api/v1/products", "POST", body);
}
