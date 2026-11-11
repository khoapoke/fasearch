import type { NextRequest } from "next/server";
import { adminIdentity } from "@/lib/server/admin-bff";
import { authCookie, authError } from "@/lib/server/customer-auth";
import { BE } from "@/lib/server/admin-catalog";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** The Vietnamese product import template, byte-for-byte from the backend. */
export async function GET(request: NextRequest) {
  const who = await adminIdentity(request);
  if ("response" in who) return who.response;
  const token = authCookie(request);
  if (!token) return authError("Thiếu phiên quản trị.", 401);

  try {
    const upstream = await fetch(`${BE}/api/v1/admin/csv/products/template`, {
      method: "GET",
      headers: { authorization: `Bearer ${token}`, accept: "text/csv" },
      cache: "no-store",
      signal: AbortSignal.any([request.signal, AbortSignal.timeout(12_000)]),
    });
    const headers = new Headers({ "cache-control": "no-store" });
    for (const name of ["content-type", "content-disposition", "x-content-type-options"]) {
      const value = upstream.headers.get(name);
      if (value) headers.set(name, value);
    }
    return new Response(upstream.body, { status: upstream.status, headers });
  } catch {
    return authError("Không tải được tệp mẫu CSV.", 503);
  }
}
