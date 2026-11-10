import type { NextRequest } from "next/server";
import { adminIdentity } from "@/lib/server/admin-bff";
import { authCookie } from "@/lib/server/customer-auth";
import { BE } from "@/lib/server/admin-catalog";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const n = Number(id);
  if (!Number.isSafeInteger(n) || n < 1) return Response.json({ success: false, code: 400, message: "Mã sản phẩm chưa hợp lệ.", result: null }, { status: 400, headers: { "cache-control": "no-store" } });
  const who = await adminIdentity(request);
  if ("response" in who) return who.response;
  const token = authCookie(request);
  if (!token) return Response.json({ success: false, code: 401, message: "Thiếu phiên quản trị.", result: null }, { status: 401, headers: { "cache-control": "no-store" } });
  const contentType = request.headers.get("content-type");
  if (!contentType || !contentType.toLowerCase().includes("multipart/form-data")) {
    return Response.json({ success: false, code: 400, message: "Yêu cầu phải là multipart/form-data.", result: null }, { status: 400, headers: { "cache-control": "no-store" } });
  }
  try {
    const body = await request.arrayBuffer();
    const upstream = await fetch(`${BE}/api/v1/products/${n}/image`, {
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
    return Response.json({ success: false, code: 503, message: "Không kết nối được máy chủ catalog.", result: null }, { status: 503, headers: { "cache-control": "no-store" } });
  }
}
