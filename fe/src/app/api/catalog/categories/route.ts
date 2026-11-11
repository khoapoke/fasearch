import { catalogUpstream, jsonError, readJson } from "@/lib/catalog-upstream";

export const dynamic = "force-dynamic";

/**
 * R5: danh mục thật trên TOÀN catalog từ endpoint hợp đồng
 * `GET /api/v1/categories/with-counts` (BE FINAL đã triển khai).
 * Không quét dự phòng, không danh mục suy đoán: lỗi upstream ⇒ 503 trung
 * thực kèm nút thử lại ở UI, danh mục rỗng ⇒ hợp lệ (chỉ còn "Tất cả").
 */
export async function GET() {
  try {
    const upstream = await catalogUpstream("/api/v1/categories/with-counts");
    const payload = (await readJson(upstream)) as {
      success?: boolean;
      message?: string;
      result?: Array<{ id?: unknown; categoryName?: unknown; productCount?: unknown }>;
    } | null;
    if (!upstream.ok || !payload?.success || !Array.isArray(payload.result)) {
      return Response.json(
        payload ?? { success: false, code: upstream.status, message: "Không tải được danh mục.", result: null },
        { status: upstream.status || 502 },
      );
    }
    const counted = payload.result.flatMap((row) =>
      typeof row.id === "number" &&
      Number.isInteger(row.id) &&
      row.id > 0 &&
      typeof row.categoryName === "string" &&
      row.categoryName.trim() !== "" &&
      typeof row.productCount === "number" &&
      row.productCount > 0
        ? [{ id: row.id, categoryName: row.categoryName }]
        : [],
    );
    return Response.json(
      { success: true, code: 200, message: "OK", result: counted },
      { status: 200 },
    );
  } catch {
    return jsonError("Không kết nối được máy chủ danh mục.", 503);
  }
}
