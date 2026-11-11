import type { NextRequest } from "next/server";
import { requireJsonPost, authError, readJsonObject } from "@/lib/server/customer-auth";
import { stockRead, stockWrite } from "@/lib/server/admin-stock";
export const dynamic = "force-dynamic"; export const runtime = "nodejs";
export async function GET(request: NextRequest) {
  const p = request.nextUrl.searchParams; const page = Number(p.get("page") ?? "0"); const size = Number(p.get("size") ?? "10");
  if (!Number.isInteger(page) || page < 0 || page > 10000 || !Number.isInteger(size) || size < 1 || size > 50) return Response.json({ success: false, code: 400, message: "Phân trang chưa hợp lệ.", result: null }, { status: 400 });
  const q = new URLSearchParams({ page: String(page), size: String(size), sort: "id,desc" });
  for (const k of ["receiptCode", "supplierName"]) { const v = p.get(k); if (v) q.set(k, v.trim()); }
  return stockRead(request, `/api/v1/inventory/import-receipts?${q}`);
}
export async function POST(request: NextRequest) {
  const guard = requireJsonPost(request); if (guard) return guard;
  const parsed = await readJsonObject(request); if (!parsed.ok) return parsed.response;
  const b = parsed.body; const supplierName = typeof b.supplierName === "string" ? b.supplierName.trim() : ""; const note = typeof b.note === "string" ? b.note : "";
  if (!supplierName || supplierName.length > 255) return authError("Tên nhà cung cấp phải từ 1 đến 255 ký tự.", 400);
  if (!Array.isArray(b.items) || b.items.length === 0 || b.items.length > 50) return authError("Phiếu nhập phải có từ 1 đến 50 dòng.", 400);
  const seen = new Set<number>(); const items: Array<{ skuId: number; quantity: number; importPrice: number }> = [];
  for (const raw of b.items) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return authError("Dòng nhập chưa hợp lệ.", 400);
    const row = raw as Record<string, unknown>; const skuId = row.skuId; const quantity = row.quantity; const importPrice = row.importPrice;
    if (typeof skuId !== "number" || !Number.isSafeInteger(skuId) || skuId < 1) return authError("SKU chưa hợp lệ.", 400);
    if (seen.has(skuId)) return authError("Mỗi SKU chỉ được xuất hiện một lần trong phiếu.", 400, "DUPLICATE_SKU");
    seen.add(skuId);
    if (typeof quantity !== "number" || !Number.isSafeInteger(quantity) || quantity < 1) return authError("Số lượng nhập phải là số nguyên dương.", 400);
    if (typeof importPrice !== "number" || !Number.isFinite(importPrice) || importPrice <= 0) return authError("Giá nhập phải lớn hơn 0.", 400);
    items.push({ skuId, quantity, importPrice });
  }
  return stockWrite(request, "/api/v1/inventory/import-receipts", { supplierName, ...(note.trim() ? { note: note.trim() } : {}), items });
}
