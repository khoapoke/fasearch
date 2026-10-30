import type { NextRequest } from "next/server";
import { requireJsonPost, authError, readJsonObject } from "@/lib/server/customer-auth";
import { catalogRead, catalogWrite, idOf } from "@/lib/server/admin-catalog";
export const dynamic = "force-dynamic"; export const runtime = "nodejs";
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) { const { id } = await params; const n = idOf(id); return n ? catalogRead(request, `/api/v1/categories/${n}`) : authError("Mã danh mục chưa hợp lệ.", 400); }
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = requireJsonPost(request); if (guard) return guard;
  const { id } = await params; const n = idOf(id); if (!n) return authError("Mã danh mục chưa hợp lệ.", 400);
  const parsed = await readJsonObject(request); if (!parsed.ok) return parsed.response;
  const name = typeof parsed.body.categoryName === "string" ? parsed.body.categoryName.trim() : "";
  if (!name || name.length > 150) return authError("Tên danh mục phải từ 1 đến 150 ký tự.", 400);
  return catalogWrite(request, `/api/v1/categories/${n}`, "PATCH", { categoryName: name });
}
