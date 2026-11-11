import { catalogUpstream, jsonError, readJson, resolveCatalogImage } from "@/lib/catalog-upstream";

export const dynamic = "force-dynamic";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!/^\d+$/.test(id) || Number(id) <= 0) return jsonError("Mã sản phẩm chưa hợp lệ.", 400);
  const limit = new URL(request.url).searchParams.get("limit");
  const q = limit && /^\d{1,2}$/.test(limit) ? `?limit=${Number(limit)}` : "";
  try {
    const upstream = await catalogUpstream(`/api/v1/products/${id}/related${q}`);
    const payload = (await readJson(upstream)) as { success?: boolean; result?: Array<Record<string, unknown>> } | null;
    if (!upstream.ok || !payload?.success || !Array.isArray(payload.result)) {
      return Response.json(payload ?? { success: false, code: upstream.status, message: "Không tải được sản phẩm liên quan.", result: null }, { status: upstream.status || 502 });
    }
    return Response.json({ ...payload, result: payload.result.map((p) => ({ ...p, imageUrl: resolveCatalogImage(p.imageUrl as string | null | undefined) })) }, { status: upstream.status });
  } catch {
    return jsonError("Không kết nối được máy chủ danh mục.", 503);
  }
}
