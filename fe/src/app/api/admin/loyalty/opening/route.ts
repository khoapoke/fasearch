import type { NextRequest } from "next/server";
import { readBoundedJsonObject } from "@/lib/server/bounded-json";
import { adminIdentity } from "@/lib/server/admin-bff";
import { promotionsUpstream } from "@/lib/server/promotions-bff";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  // Ghi nhận số dư mở đầu là migration sổ cái một lần: BE giữ ADMIN-only (AUTHZ-MATRIX), Quản lý không được.
  const who = await adminIdentity(request);
  if ("response" in who) return who.response;
  if (who.identity.role !== "ADMIN") return Response.json({ success: false, code: 403, message: "Chỉ Quản trị viên hệ thống được ghi nhận số dư mở đầu.", result: null }, { status: 403, headers: { "cache-control": "no-store" } });
  const parsed = await readBoundedJsonObject(request, 4 * 1024);
  const customerId = parsed.ok ? parsed.body.customerId : null;
  if (!Number.isSafeInteger(customerId) || (customerId as number) <= 0) return Response.json({ success: false, code: 400, message: "Mã khách hàng chưa hợp lệ.", result: null }, { status: 400, headers: { "cache-control": "no-store" } });
  return promotionsUpstream(request, "/api/v1/quan-tri/thanh-vien/mo-dau", "POST", { customerId });
}
