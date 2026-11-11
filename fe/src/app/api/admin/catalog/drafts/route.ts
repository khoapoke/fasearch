import type { NextRequest } from "next/server";
import { requireJsonPost, authError, readJsonObject } from "@/lib/server/customer-auth";
import { catalogRead, catalogWrite } from "@/lib/server/admin-catalog";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Danh sách bản nháp đang mở (phân trang server). */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const page = url.searchParams.get("page") ?? "0";
  const size = url.searchParams.get("size") ?? "10";
  if (!/^\d+$/.test(page) || !/^\d+$/.test(size)) {
    return authError("Tham số phân trang chưa hợp lệ.", 400);
  }
  return catalogRead(request, `/api/v1/admin/products/drafts?page=${page}&size=${size}`);
}

/**
 * Mở bản nháp mới. Body truyền thẳng cho BE (cùng kiểm chứng với ProductCreateReq
 * + provenance source{Url,Hash,Kind} tùy chọn); có thể kèm productId để BE liên kết
 * bản nháp sửa với sản phẩm đã xuất bản.
 */
export async function POST(request: NextRequest) {
  const guard = requireJsonPost(request);
  if (guard) return guard;
  const parsed = await readJsonObject(request);
  if (!parsed.ok) return parsed.response;
  const b = parsed.body;
  if (typeof b.productName !== "string" || !b.productName.trim() || b.productName.trim().length > 255) {
    return authError("Tên sản phẩm phải từ 1 đến 255 ký tự.", 400);
  }
  if (typeof b.categoryId !== "number" || !Number.isSafeInteger(b.categoryId) || b.categoryId < 1) {
    return authError("Danh mục chưa hợp lệ.", 400);
  }
  if (typeof b.price !== "number" || !Number.isFinite(b.price) || b.price < 0) {
    return authError("Giá bán phải là số không âm.", 400);
  }
  const body: Record<string, unknown> = {
    productName: b.productName.trim(),
    categoryId: b.categoryId,
    price: b.price,
  };
  if (typeof b.productId === "number" && Number.isSafeInteger(b.productId) && b.productId > 0) {
    body.productId = b.productId;
  }
  for (const k of ["brandId", "modelCode", "material", "style", "description", "imageUrl", "status"] as const) {
    if (b[k] !== undefined && b[k] !== null) body[k] = b[k];
  }
  if (Array.isArray(b.variants)) body.variants = b.variants;
  for (const k of ["sourceUrl", "sourceHash", "sourceKind"] as const) {
    if (typeof b[k] === "string" && b[k]) body[k] = b[k];
  }
  return catalogWrite(request, "/api/v1/admin/products/drafts", "POST", body);
}
