import type { NextRequest } from "next/server";
import { catalogRead } from "@/lib/server/admin-catalog";
export const dynamic = "force-dynamic"; export const runtime = "nodejs";
// Barcode scanner lookup: exact barcode, then SKU id. Works for SKUs that have no stock row yet.
export async function GET(request: NextRequest) {
  const code = (request.nextUrl.searchParams.get("code") ?? "").trim();
  if (!code || code.length > 100) return Response.json({ success: false, code: 400, message: "Mã quét chưa hợp lệ.", result: null }, { status: 400 });
  return catalogRead(request, `/api/v1/products/variants/scan-lookup?code=${encodeURIComponent(code)}`);
}
