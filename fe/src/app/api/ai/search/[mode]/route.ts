import type { NextRequest } from "next/server";
import { aiSearch } from "@/lib/server/ai-search";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export async function POST(request: NextRequest, { params }: { params: Promise<{ mode: string }> }) {
  const { mode } = await params;
  return aiSearch(request, mode);
}
