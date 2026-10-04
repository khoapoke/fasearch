import { NextRequest } from "next/server";
import { proxyCatalogGet } from "@/lib/catalog-proxy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const backendUrl = process.env.FASEARCH_BACKEND_URL ?? "http://127.0.0.1:8080";

export async function GET(request: NextRequest) {
  return proxyCatalogGet(request, backendUrl, "/api/v1/catalog/products");
}
