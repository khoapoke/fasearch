import type { NextRequest } from "next/server";
import { adminRead } from "@/lib/server/admin-bff";
export const dynamic = "force-dynamic";
export async function GET(request: NextRequest) {
  const query = new URLSearchParams();
  for (const key of ["from", "to", "actor", "objectType", "action", "q", "page", "size"]) {
    const value = request.nextUrl.searchParams.get(key); if (value !== null) query.set(key, value);
  }
  return adminRead(request, `/api/v1/admin/audit?${query}`);
}
