import type { NextRequest } from "next/server";
import { getStaffPermissions, putStaffPermissions } from "@/lib/server/admin-role-permissions";
export const dynamic = "force-dynamic"; export const runtime = "nodejs";
export function GET(request: NextRequest) { return getStaffPermissions(request); }
export function PUT(request: NextRequest) { return putStaffPermissions(request); }
