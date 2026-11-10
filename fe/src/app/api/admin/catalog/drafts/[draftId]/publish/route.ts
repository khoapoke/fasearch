import type { NextRequest } from "next/server";
import { requireJsonPost, authError, readJsonObject } from "@/lib/server/customer-auth";
import { catalogWrite, idOf } from "@/lib/server/admin-catalog";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Xuất bản bản nháp: hợp nhất vào hàng đã xuất bản trong một transaction,
 * version++, ghi hàng AI PENDING rồi mới commit. Yêu cầu expectedVersion;
 * BE trả 409 khi phiên đã cũ — FE không bao giờ ghi đè im lặng.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ draftId: string }> }) {
  const guard = requireJsonPost(request);
  if (guard) return guard;
  const { draftId } = await params;
  const n = idOf(draftId);
  if (!n) return authError("Mã Draft chưa hợp lệ.", 400);
  const parsed = await readJsonObject(request);
  if (!parsed.ok) return parsed.response;
  const { expectedVersion } = parsed.body;
  if (typeof expectedVersion !== "number" || !Number.isSafeInteger(expectedVersion) || expectedVersion < 1) {
    return authError("Thiếu expectedVersion để chống ghi đè.", 400, "VERSION_REQUIRED");
  }
  return catalogWrite(request, `/api/v1/admin/products/drafts/${n}/publish`, "POST", { expectedVersion });
}
