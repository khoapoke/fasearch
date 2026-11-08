import type { NextRequest } from "next/server";
import { authCookie } from "@/lib/server/customer-auth";
import { adminIdentity, BE } from "@/lib/server/admin-bff";

/**
 * Pipe a backend CSV export through the admin BFF. Large exports must not be cut by the
 * 12-second timeout used by the JSON reads, so this route keeps only the client signal.
 */
export async function csvExport(request: NextRequest, path: string): Promise<Response> {
  const who = await adminIdentity(request);
  if ("response" in who) return who.response;
  const token = authCookie(request);
  if (!token) {
    return Response.json({ success: false, code: 401, message: "Thiếu phiên quản trị.", result: null },
      { status: 401, headers: { "cache-control": "no-store" } });
  }
  try {
    const upstream = await fetch(`${BE}${path}`, {
      method: "GET",
      headers: { accept: "text/csv", authorization: `Bearer ${token}` },
      cache: "no-store",
      redirect: "manual",
      signal: request.signal,
    });
    const headers = new Headers({ "cache-control": "no-store" });
    for (const name of ["content-type", "content-disposition", "x-content-type-options", "x-export-rows"]) {
      const value = upstream.headers.get(name);
      if (value) headers.set(name, value);
    }
    return new Response(upstream.body, { status: upstream.status, headers });
  } catch {
    return Response.json({ success: false, code: 503, message: "Không kết nối được máy chủ để xuất CSV.", result: null },
      { status: 503, headers: { "cache-control": "no-store" } });
  }
}
