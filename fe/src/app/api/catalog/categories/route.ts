import { catalogUpstream, jsonError, readJson } from "@/lib/catalog-upstream";

export const dynamic = "force-dynamic";

type CategoryRow = { id?: unknown; categoryName?: unknown };

/**
 * R5: danh mục thật trên TOÀN catalog — không bao giờ suy từ trang đầu.
 * Ưu tiên `GET /api/v1/categories/with-counts` (BE triển khai cùng đợt sửa taxonomy);
 * khi chưa có, quét toàn bộ published (2 trang × 2000, bounded) thay vì page đầu.
 */
async function tryWithCounts(): Promise<Array<{ id: number; categoryName: string }> | null> {
  try {
    const upstream = await catalogUpstream("/api/v1/categories/with-counts");
    const payload = (await readJson(upstream)) as {
      success?: boolean;
      result?: Array<{ id?: unknown; categoryName?: unknown; productCount?: unknown }>;
    } | null;
    if (!upstream.ok || !payload?.success || !Array.isArray(payload.result)) return null;
    const rows: Array<{ id: number; categoryName: string }> = [];
    for (const row of payload.result) {
      if (
        typeof row.id === "number" &&
        Number.isInteger(row.id) &&
        row.id > 0 &&
        typeof row.categoryName === "string" &&
        row.categoryName.trim() !== "" &&
        typeof row.productCount === "number" &&
        row.productCount > 0
      ) {
        rows.push({ id: row.id, categoryName: row.categoryName });
      }
    }
    // Endpoint tồn tại nhưng rỗng/sai hình ⇒ coi như chưa sẵn, dùng quét dự phòng.
    return rows.length > 0 ? rows : null;
  } catch {
    return null;
  }
}

export async function GET() {
  try {
    const counted = await tryWithCounts();
    if (counted) {
      return Response.json(
        { success: true, code: 200, message: "OK", result: counted },
        { status: 200 },
      );
    }
    const upstream = await catalogUpstream("/api/v1/categories");
    const payload = (await readJson(upstream)) as { success?: boolean; message?: string; result?: CategoryRow[] } | null;
    if (!upstream.ok || !payload?.success || !Array.isArray(payload.result)) {
      return Response.json(payload ?? { success: false, code: upstream.status, message: "Không tải được danh mục.", result: null }, { status: upstream.status || 502 });
    }
    // Quét dự phòng: toàn bộ ACTIVE (bounded 2 trang), giữ danh mục đang có hàng thật.
    const used = new Set<number>();
    for (const page of [0, 1]) {
      const productsResponse = await catalogUpstream(`/api/v1/products?page=${page}&size=2000&status=ACTIVE`);
      const productsPayload = (await readJson(productsResponse)) as { success?: boolean; result?: { content?: Array<{ categoryId?: unknown }>; totalElements?: unknown } } | null;
      if (!productsResponse.ok || !productsPayload?.success || !Array.isArray(productsPayload.result?.content)) {
        return Response.json(payload, { status: upstream.status });
      }
      for (const p of productsPayload.result.content) {
        if (typeof p.categoryId === "number" && Number.isInteger(p.categoryId) && p.categoryId > 0) used.add(p.categoryId);
      }
      if (typeof productsPayload.result.totalElements === "number" && (page + 1) * 2000 >= productsPayload.result.totalElements) break;
    }
    return Response.json({ ...payload, result: payload.result.filter((c) => typeof c.id === "number" && used.has(c.id)) }, { status: upstream.status });
  } catch {
    return jsonError("Không kết nối được máy chủ danh mục.", 503);
  }
}
