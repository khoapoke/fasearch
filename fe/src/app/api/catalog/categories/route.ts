import { catalogUpstream, jsonError, readJson } from "@/lib/catalog-upstream";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const upstream = await catalogUpstream("/api/v1/categories");
    const payload = (await readJson(upstream)) as { success?: boolean; message?: string; result?: Array<{ id?: unknown; categoryName?: unknown }> } | null;
    if (!upstream.ok || !payload?.success || !Array.isArray(payload.result)) {
      return Response.json(payload ?? { success: false, code: upstream.status, message: "Không tải được danh mục.", result: null }, { status: upstream.status || 502 });
    }
    // The demo catalog has many historical empty categories. Keep the sidebar
    // useful by exposing only categories that currently contain active products.
    const productsResponse = await catalogUpstream("/api/v1/products?page=0&size=100&status=ACTIVE");
    const productsPayload = (await readJson(productsResponse)) as { success?: boolean; result?: { content?: Array<{ categoryId?: unknown }> } } | null;
    if (!productsResponse.ok || !productsPayload?.success || !Array.isArray(productsPayload.result?.content)) {
      return Response.json(payload, { status: upstream.status });
    }
    const used = new Set(productsPayload.result.content.map((p) => p.categoryId).filter((id): id is number => typeof id === "number" && Number.isInteger(id) && id > 0));
    return Response.json({ ...payload, result: payload.result.filter((c) => typeof c.id === "number" && used.has(c.id)) }, { status: upstream.status });
  } catch {
    return jsonError("Không kết nối được máy chủ danh mục.", 503);
  }
}
