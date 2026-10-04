import { NextRequest } from "next/server";
import { proxyCatalogGet } from "@/lib/catalog-proxy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const backendUrl = process.env.FASEARCH_BACKEND_URL ?? "http://127.0.0.1:8080";

export async function GET(request: NextRequest, context: RouteContext<"/api/catalog/products/[productId]">) {
  const { productId } = await context.params;
  return proxyCatalogGet(request, backendUrl, `/api/v1/catalog/products/${encodeURIComponent(productId)}`);
}
