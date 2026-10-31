import type { NextRequest } from "next/server";
import { catalogRead, idOf } from "@/lib/server/admin-catalog";
export const dynamic = "force-dynamic"; export const runtime = "nodejs";
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) { const { id } = await params; const n = idOf(id); return n ? catalogRead(request, `/api/v1/products/variants/${n}/barcode/image`, true) : new Response(null, { status: 400 }); }
