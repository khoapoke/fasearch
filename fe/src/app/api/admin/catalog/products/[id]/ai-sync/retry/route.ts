import type { NextRequest } from "next/server";
import { authError } from "@/lib/server/customer-auth";
import { catalogWrite, idOf } from "@/lib/server/admin-catalog";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Thử lại đồng bộ AI: xếp lại FAILED thành PENDING; không làm gì khi phiên bản
 * hiện tại đã READY. Lũy đẳng, an toàn khi worker khởi động lại.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const n = idOf(id);
  if (!n) return authError("Mã sản phẩm chưa hợp lệ.", 400);
  return catalogWrite(request, `/api/v1/admin/products/${n}/ai-sync/retry`, "POST", {});
}
