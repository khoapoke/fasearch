import type { NextRequest } from "next/server";
import { adminRead } from "@/lib/server/admin-bff";
export const dynamic = "force-dynamic";
export async function GET(request: NextRequest) {
  return adminRead(request, "/api/v1/admin/notifications");
}
