import type { NextRequest } from "next/server";
import { readBoundedJsonObject } from "@/lib/server/bounded-json";
import { adminIdentity } from "@/lib/server/admin-bff";
import { promotionId, promotionsUpstream } from "@/lib/server/promotions-bff";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
const fail = (status: number, message: string) => Response.json({ success: false, code: status, message, result: null }, { status, headers: { "cache-control": "no-store" } });
const REASONS = new Set(["BOI_THUONG", "DIEU_CHINH_SAI_SOT", "TANG_THEM", "HOAN_DON", "KHAC"]);

/** Điều chỉnh điểm thủ công. Cần quyền LOYALTY_ADJUST (ADMIN luôn có); BE kiểm tra quyền ở mỗi yêu cầu. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ customerId: string }> }) {
  const who = await adminIdentity(request);
  if ("response" in who) return who.response;
  const customerId = promotionId((await params).customerId);
  if (!customerId) return fail(400, "Mã khách hàng chưa hợp lệ.");
  const parsed = await readBoundedJsonObject(request, 4 * 1024);
  if (!parsed.ok) return fail(400, "Dữ liệu điều chỉnh chưa hợp lệ.");
  const { delta, reasonCode, note, requestId } = parsed.body;
  if (!Number.isSafeInteger(delta) || delta === 0 || Math.abs(delta as number) > 2_000_000_000) return fail(400, "Số điểm điều chỉnh phải là số nguyên khác 0.");
  if (typeof reasonCode !== "string" || !REASONS.has(reasonCode)) return fail(400, "Hãy chọn lý do điều chỉnh.");
  if (note !== undefined && note !== null && (typeof note !== "string" || note.length > 500)) return fail(400, "Ghi chú tối đa 500 ký tự.");
  if (reasonCode === "KHAC" && !(typeof note === "string" && note.trim())) return fail(400, "Lý do Khác cần có ghi chú.");
  if (typeof requestId !== "string" || !/^[A-Za-z0-9-]{8,36}$/.test(requestId)) return fail(400, "Yêu cầu chưa hợp lệ. Tải lại trang rồi thử lại.");
  return promotionsUpstream(request, `/api/v1/quan-tri/thanh-vien/khach-hang/${customerId}/dieu-chinh`, "POST",
    { delta, reasonCode, note: typeof note === "string" ? note : null, requestId });
}
