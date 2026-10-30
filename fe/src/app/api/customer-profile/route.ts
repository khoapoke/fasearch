import type { NextRequest } from "next/server";
import { getSelfProfile, updateSelfProfile } from "@/lib/server/customer-profile";
export const dynamic = "force-dynamic"; export const runtime = "nodejs";
export async function GET(request: NextRequest) { return getSelfProfile(request); }
export async function PATCH(request: NextRequest) { return updateSelfProfile(request); }
