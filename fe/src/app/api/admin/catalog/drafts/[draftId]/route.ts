import type { NextRequest } from "next/server";
import { requireJsonPost, authError, readJsonObject } from "@/lib/server/customer-auth";
import { catalogRead, catalogWrite, catalogDelete, idOf } from "@/lib/server/admin-catalog";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function draftOf(params: { draftId: string }): number | null {
  return idOf(params.draftId);
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ draftId: string }> }) {
  const { draftId } = await params;
  const n = draftOf({ draftId });
  if (!n) return authError("Mã bản nháp chưa hợp lệ.", 400);
  return catalogRead(request, `/api/v1/admin/products/drafts/${n}`);
}

/** Sửa bản nháp: yêu cầu expectedVersion; BE trả 409 khi phiên đã cũ (không ghi đè). */
export async function PUT(request: NextRequest, { params }: { params: Promise<{ draftId: string }> }) {
  const guard = requireJsonPost(request);
  if (guard) return guard;
  const { draftId } = await params;
  const n = draftOf({ draftId });
  if (!n) return authError("Mã bản nháp chưa hợp lệ.", 400);
  const parsed = await readJsonObject(request);
  if (!parsed.ok) return parsed.response;
  const b = parsed.body;
  if (typeof b.expectedVersion !== "number" || !Number.isSafeInteger(b.expectedVersion) || b.expectedVersion < 1) {
    return authError("Thiếu expectedVersion để chống ghi đè.", 400, "VERSION_REQUIRED");
  }
  const { expectedVersion, ...fields } = b as Record<string, unknown>;
  return catalogWrite(request, `/api/v1/admin/products/drafts/${n}`, "PUT", { ...fields, expectedVersion });
}

/** Xóa bản nháp: chỉ xóa hàng nháp, không động đến dữ liệu đã xuất bản/đơn hàng. */
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ draftId: string }> }) {
  const { draftId } = await params;
  const n = draftOf({ draftId });
  if (!n) return authError("Mã bản nháp chưa hợp lệ.", 400);
  return catalogDelete(request, `/api/v1/admin/products/drafts/${n}`);
}
