import type { NextRequest } from "next/server";
import { requireJsonPost, authError, readJsonObject } from "@/lib/server/customer-auth";
import { catalogRead, catalogWrite, catalogDelete, idOf } from "@/lib/server/admin-catalog";
const STATUS = new Set(["DRAFT", "ACTIVE", "OUT_OF_STOCK", "DISCONTINUED"]);
export const dynamic = "force-dynamic"; export const runtime = "nodejs";
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) { const { id } = await params; const n = idOf(id); return n ? catalogRead(request, `/api/v1/products/${n}`) : Response.json({ success: false, code: 400, message: "Mã sản phẩm chưa hợp lệ.", result: null }, { status: 400 }); }
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = requireJsonPost(request); if (guard) return guard;
  const { id } = await params; const n = idOf(id); if (!n) return authError("Mã sản phẩm chưa hợp lệ.", 400);
  const parsed = await readJsonObject(request); if (!parsed.ok) return parsed.response;
  const b = parsed.body; if ("variants" in b) return authError("Metadata PATCH không được gửi variants; hãy dùng endpoint SKU.", 400, "VARIANTS_NOT_ALLOWED");
  const body: Record<string, unknown> = {};
  if (typeof b.productName === "string") { const v = b.productName.trim(); if (!v || v.length > 255) return authError("Tên sản phẩm phải từ 1 đến 255 ký tự.", 400); body.productName = v; }
  if (typeof b.categoryId === "number") { if (!Number.isSafeInteger(b.categoryId) || b.categoryId < 1) return authError("Danh mục chưa hợp lệ.", 400); body.categoryId = b.categoryId; }
  if (typeof b.price === "number") { if (!Number.isFinite(b.price) || b.price < 0) return authError("Giá bán phải là số không âm.", 400); body.price = b.price; }
  if (typeof b.status === "string") { if (!STATUS.has(b.status)) return authError("Trạng thái chưa hợp lệ.", 400); body.status = b.status; }
  for (const k of ["material", "style", "description", "imageUrl"] as const) if (typeof b[k] === "string") body[k] = b[k];
  if (!Object.keys(body).length) return authError("Không có trường metadata để cập nhật.", 400);
  return catalogWrite(request, `/api/v1/products/${n}`, "PATCH", body);
}
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) { const { id } = await params; const n = idOf(id); return n ? catalogDelete(request, `/api/v1/products/${n}`) : Response.json({ success: false, code: 400, message: "Mã sản phẩm chưa hợp lệ.", result: null }, { status: 400 }); }
