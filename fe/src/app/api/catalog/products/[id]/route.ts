import { catalogUpstream, jsonError, readJson, resolveCatalogImage } from "@/lib/catalog-upstream";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!/^\d+$/.test(id) || Number(id) <= 0) return jsonError("Mã sản phẩm chưa hợp lệ.", 400);
  try {
    const upstream = await catalogUpstream(`/api/v1/products/${id}`);
    const payload = (await readJson(upstream)) as {
      success?: boolean;
      message?: string;
      result?: Record<string, unknown>;
    } | null;
    if (!upstream.ok || !payload?.success || !payload.result) {
      return Response.json(
        payload ?? { success: false, code: upstream.status, message: "Không tìm thấy sản phẩm.", result: null },
        { status: upstream.status || 502 },
      );
    }
    return Response.json(
      { ...payload, result: { ...payload.result, imageUrl: resolveCatalogImage(payload.result.imageUrl) } },
      { status: upstream.status },
    );
  } catch {
    return jsonError("Không kết nối được máy chủ danh mục.", 503);
  }
}
