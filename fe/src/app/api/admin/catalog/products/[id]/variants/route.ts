import type { NextRequest } from "next/server";
import { requireJsonPost, authError, readJsonObject } from "@/lib/server/customer-auth";
import { catalogRead, catalogWrite, idOf } from "@/lib/server/admin-catalog";
export const dynamic = "force-dynamic"; export const runtime = "nodejs";
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) { const { id } = await params; const n = idOf(id); return n ? catalogRead(request, `/api/v1/products/${n}/variants`) : authError("Mã sản phẩm chưa hợp lệ.", 400); }
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = requireJsonPost(request); if (guard) return guard;
  const { id } = await params; const n = idOf(id); if (!n) return authError("Mã sản phẩm chưa hợp lệ.", 400);
  const parsed = await readJsonObject(request); if (!parsed.ok) return parsed.response;
  const b = parsed.body; const color = typeof b.color === "string" ? b.color.trim() : ""; const size = typeof b.size === "string" ? b.size.trim() : ""; const barcode = typeof b.barcode === "string" ? b.barcode.trim() : "";
  if (!color || color.length > 50) return authError("Màu sắc phải từ 1 đến 50 ký tự.", 400);
  if (!size || size.length > 50) return authError("Kích cỡ phải từ 1 đến 50 ký tự.", 400);
  if (barcode.length > 100) return authError("Mã vạch tối đa 100 ký tự.", 400);
  return catalogWrite(request, `/api/v1/products/${n}/variants`, "POST", { color, size, ...(barcode ? { barcode } : {}) });
}
