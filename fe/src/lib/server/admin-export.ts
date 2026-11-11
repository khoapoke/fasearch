import type { NextRequest } from "next/server";
import { requireJsonPost, authError, readJsonObject } from "@/lib/server/customer-auth";
import { stockRead, stockWrite, positiveId } from "@/lib/server/admin-stock";
const TYPES = new Set(["DAMAGED", "OTHER"]);
export const dynamic = "force-dynamic"; export const runtime = "nodejs";
export async function GET(request: NextRequest, path: string) { return stockRead(request, path); }
export async function POST(request: NextRequest) {
  const guard = requireJsonPost(request); if (guard) return guard;
  const parsed = await readJsonObject(request); if (!parsed.ok) return parsed.response;
  const b = parsed.body; const type = typeof b.exportType === "string" ? b.exportType : ""; const note = typeof b.note === "string" ? b.note : "";
  if (!TYPES.has(type)) return authError("Phiếu xuất chỉ hỗ trợ DAMAGED hoặc OTHER; TRANSFER chưa có hợp đồng kho đích.", 400, "UNSUPPORTED_EXPORT_TYPE");
  if (!Array.isArray(b.items) || b.items.length === 0 || b.items.length > 50) return authError("Phiếu xuất phải có từ 1 đến 50 dòng.", 400);
  const seen = new Set<number>(); const items: Array<{ skuId: number; quantity: number; reason?: string }> = [];
  for (const raw of b.items) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return authError("Dòng xuất chưa hợp lệ.", 400);
    const row = raw as Record<string, unknown>; const skuId = row.skuId; const quantity = row.quantity; const reason = typeof row.reason === "string" ? row.reason.trim() : "";
    if (typeof skuId !== "number" || !Number.isSafeInteger(skuId) || skuId < 1) return authError("SKU chưa hợp lệ.", 400);
    if (seen.has(skuId)) return authError("Mỗi SKU chỉ được xuất hiện một lần trong phiếu.", 400, "DUPLICATE_SKU");
    seen.add(skuId);
    if (typeof quantity !== "number" || !Number.isSafeInteger(quantity) || quantity < 1) return authError("Số lượng xuất phải là số nguyên dương.", 400);
    if (reason.length > 255) return authError("Lý do xuất tối đa 255 ký tự.", 400);
    items.push({ skuId, quantity, ...(reason ? { reason } : {}) });
  }
  return stockWrite(request, "/api/v1/inventory/export-receipts", { exportType: type, ...(note.trim() ? { note: note.trim() } : {}), items });
}
export { positiveId };
