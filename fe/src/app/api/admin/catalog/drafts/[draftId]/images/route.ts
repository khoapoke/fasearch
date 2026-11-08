import type { NextRequest } from "next/server";
import { authError } from "@/lib/server/customer-auth";
import { adminIdentity } from "@/lib/server/admin-bff";
import { authCookie } from "@/lib/server/customer-auth";
import { BE, idOf } from "@/lib/server/admin-catalog";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Tải ảnh lên bản nháp (multipart `file`, PNG/JPG/JPEG/WEBP ≤5MB, kiểm tra byte
 * ở máy chủ). Ảnh được dàn trên nháp — không mồ côi khi giao dịch lỗi, không
 * động đến nội dung đang bán.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ draftId: string }> }) {
  const { draftId } = await params;
  const n = idOf(draftId);
  if (!n) return authError("Mã Draft chưa hợp lệ.", 400);
  const who = await adminIdentity(request);
  if ("response" in who) return who.response;
  const token = authCookie(request);
  if (!token) return authError("Thiếu phiên quản trị.", 401);
  const contentType = request.headers.get("content-type");
  if (!contentType || !contentType.toLowerCase().includes("multipart/form-data")) {
    return authError("Yêu cầu phải là multipart/form-data.", 400);
  }
  try {
    const body = await request.arrayBuffer();
    const upstream = await fetch(`${BE}/api/v1/admin/products/drafts/${n}/images`, {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, accept: "application/json", "content-type": contentType },
      body,
      cache: "no-store",
      signal: AbortSignal.any([request.signal, AbortSignal.timeout(30000)]),
    });
    const type = upstream.headers.get("content-type");
    const headers = new Headers({ "cache-control": "no-store" });
    if (type) headers.set("content-type", type);
    return new Response(upstream.body, { status: upstream.status, headers });
  } catch {
    return authError("Không kết nối được máy chủ catalog.", 503);
  }
}
