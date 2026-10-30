import type { NextRequest } from "next/server";
import { stocktakeCreate, stocktakeRead } from "@/lib/server/admin-stocktake";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
const STATUS = new Set(["PENDING_APPROVAL", "RECONCILED", "CANCELLED"]);
export async function POST(request: NextRequest) { return stocktakeCreate(request); }
export async function GET(request: NextRequest) {
  const p = request.nextUrl.searchParams; const page = Number(p.get("page") ?? "0"); const size = Number(p.get("size") ?? "10");
  if (!Number.isInteger(page) || page < 0 || page > 10000 || !Number.isInteger(size) || size < 1 || size > 50) return Response.json({ success: false, code: 400, message: "Phân trang chưa hợp lệ.", result: null }, { status: 400 });
  const q = new URLSearchParams({ page: String(page), size: String(size), sort: "id,desc" });
  const code = p.get("stocktakeCode"); if (code?.trim()) q.set("stocktakeCode", code.trim().slice(0, 50));
  const status = p.get("status"); if (status && STATUS.has(status)) q.set("status", status);
  return stocktakeRead(request, `/api/v1/inventory/stocktakes?${q}`);
}
