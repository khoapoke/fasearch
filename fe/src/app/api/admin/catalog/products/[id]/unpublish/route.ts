import type { NextRequest } from "next/server";
import { requireJsonPost, authError, readJsonObject } from "@/lib/server/customer-auth";
import { catalogWrite, idOf } from "@/lib/server/admin-catalog";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Gỡ xuất bản: ẩn khỏi catalog công khai + ghi tombstone xóa điểm AI.
 * Không xóa dữ liệu đã xuất bản/đơn hàng.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = requireJsonPost(request);
  if (guard) return guard;
  const { id } = await params;
  const n = idOf(id);
  if (!n) return authError("Mã sản phẩm chưa hợp lệ.", 400);
  const parsed = await readJsonObject(request);
  if (!parsed.ok) return parsed.response;
  const body: Record<string, unknown> = {};
  if (typeof parsed.body.reason === "string" && parsed.body.reason.trim()) {
    if (parsed.body.reason.trim().length > 500) return authError("Lý do tối đa 500 ký tự.", 400);
    body.reason = parsed.body.reason.trim();
  }
  return catalogWrite(request, `/api/v1/admin/products/${n}/unpublish`, "POST", body);
}
