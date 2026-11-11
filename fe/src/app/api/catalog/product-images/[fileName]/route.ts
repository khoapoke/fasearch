import type { NextRequest } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const BE = process.env.FASEARCH_BACKEND_URL?.replace(/\/+$/, "") || "http://127.0.0.1:18126";

export async function GET(request: NextRequest, { params }: { params: Promise<{ fileName: string }> }) {
  const { fileName } = await params;
  if (!fileName || fileName.includes("..") || fileName.includes("/") || fileName.includes("\\")) {
    return new Response("Bad request", { status: 400 });
  }
  try {
    const upstream = await fetch(`${BE}/api/v1/products/images/${encodeURIComponent(fileName)}`, { cache: "no-store", signal: AbortSignal.timeout(12000) });
    const type = upstream.headers.get("content-type");
    const headers = new Headers({ "cache-control": "public, max-age=3600" });
    if (type) headers.set("content-type", type);
    return new Response(upstream.body, { status: upstream.status, headers });
  } catch {
    return new Response("Unavailable", { status: 503 });
  }
}
