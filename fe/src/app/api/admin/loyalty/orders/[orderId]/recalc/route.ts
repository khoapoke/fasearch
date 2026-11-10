import type { NextRequest } from "next/server";
import { promotionId, promotionsUpstream } from "@/lib/server/promotions-bff";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
const bad = () => Response.json({ success: false, code: 400, message: "Mã đơn hàng chưa hợp lệ.", result: null }, { status: 400, headers: { "cache-control": "no-store" } });

/** Xem trước điểm sẽ được cộng cho đơn thiếu điểm. Quản lý và Quản trị viên. */
export async function GET(request: NextRequest, { params }: { params: Promise<{ orderId: string }> }) {
  const orderId = promotionId((await params).orderId);
  if (!orderId) return bad();
  return promotionsUpstream(request, `/api/v1/quan-tri/thanh-vien/don-hang/${orderId}/tinh-lai-diem`, "GET");
}

/** Ghi bút toán EARN còn thiếu (qua cùng đường tích điểm thường, an toàn khi bấm hai lần). */
export async function POST(request: NextRequest, { params }: { params: Promise<{ orderId: string }> }) {
  const orderId = promotionId((await params).orderId);
  if (!orderId) return bad();
  return promotionsUpstream(request, `/api/v1/quan-tri/thanh-vien/don-hang/${orderId}/tinh-lai-diem`, "POST", {});
}
