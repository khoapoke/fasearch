import type { NextRequest } from "next/server";
import { adminRead } from "@/lib/server/admin-bff";
export const dynamic = "force-dynamic";
export async function GET(request: NextRequest) {
  const query = new URLSearchParams();
  for (const key of ["from", "to", "actor", "objectType", "action", "q"]) {
    const value = request.nextUrl.searchParams.get(key); if (value !== null) query.set(key, value);
  }
  const upstream = await adminRead(request, `/api/v1/admin/audit/export?${query}`, "text/csv");
  const headers = new Headers(upstream.headers);
  if (upstream.ok) headers.set("content-disposition", 'attachment; filename="activity-log.csv"');
  return new Response(upstream.body, { status: upstream.status, headers });
}
