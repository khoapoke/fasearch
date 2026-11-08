import type { NextRequest } from "next/server";
import { getStaffPermissionAudit } from "@/lib/server/admin-role-permissions";
export const dynamic = "force-dynamic"; export const runtime = "nodejs";
export function GET(request: NextRequest) { return getStaffPermissionAudit(request); }
