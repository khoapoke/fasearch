import type { NextRequest } from "next/server";
import { authError } from "@/lib/server/customer-auth";
import { catalogRead, idOf } from "@/lib/server/admin-catalog";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Trạng thái đồng bộ AI: {productId, version, status, attempts, updatedAt, lastError?}. */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const n = idOf(id);
  if (!n) return authError("Mã sản phẩm chưa hợp lệ.", 400);
  return catalogRead(request, `/api/v1/admin/products/${n}/ai-sync`);
}
