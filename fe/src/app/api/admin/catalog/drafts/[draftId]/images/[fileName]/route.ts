import type { NextRequest } from "next/server";
import { authError } from "@/lib/server/customer-auth";
import { catalogRead, idOf } from "@/lib/server/admin-catalog";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Ảnh bản nháp (ADMIN-only, no-store). BE giữ file ngoài web công khai cho tới khi
 * xuất bản; route này là đường xem trước duy nhất từ trình duyệt.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ draftId: string; fileName: string }> }) {
  const { draftId, fileName } = await params;
  const n = idOf(draftId);
  if (!n) return authError("Mã bản nháp chưa hợp lệ.", 400);
  if (!fileName || fileName.length > 255 || /[\\/\0]/.test(fileName) || fileName.includes("..")) {
    return authError("Tên file chưa hợp lệ.", 400);
  }
  return catalogRead(request, `/api/v1/admin/products/drafts/${n}/images/${encodeURIComponent(fileName)}`, true);
}
