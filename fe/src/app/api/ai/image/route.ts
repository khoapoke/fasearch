import type { NextRequest } from "next/server";
import { aiImage } from "@/lib/server/ai-search";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export async function GET(request: NextRequest) { return aiImage(request); }
