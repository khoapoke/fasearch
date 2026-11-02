import type { NextRequest } from "next/server";
import { commerceUpstream } from "@/lib/server/customer-commerce";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Phép chiếu chính sách an toàn cho khách (`/api/v1/thanh-vien/chinh-sach-cua-toi`).
 * Endpoint admin `/chinh-sach` và `/chinh-sach/hang` vẫn 403 với CUSTOMER và
 * tuyệt đối không được gọi từ đây.
 */
export function GET(request: NextRequest) {
  return commerceUpstream(request, "/api/v1/thanh-vien/chinh-sach-cua-toi", { method: "GET", safeErrors: true });
}
