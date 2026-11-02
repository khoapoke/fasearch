import type { NextRequest } from "next/server";
import { authError } from "@/lib/server/customer-auth";
import { catalogRead, catalogDelete, idOf } from "@/lib/server/admin-catalog";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Xóa ảnh đã xuất bản theo tên file an toàn (?fileName=). */
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const n = idOf(id);
  if (!n) return authError("Mã sản phẩm chưa hợp lệ.", 400);
  const fileName = new URL(request.url).searchParams.get("fileName") ?? "";
  if (!fileName || fileName.length > 255 || /[\\/\0]/.test(fileName) || fileName.includes("..")) {
    return authError("Tên file chưa hợp lệ.", 400);
  }
  return catalogDelete(request, `/api/v1/admin/products/${n}/images?fileName=${encodeURIComponent(fileName)}`);
}
