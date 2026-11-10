import { catalogUpstream, jsonError, readJson } from "@/lib/catalog-upstream";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Proxy công khai cho danh sách ưu đãi đang mở (`GET /api/v1/promotions`).
 *
 * Hợp đồng BE: endpoint công khai, chỉ trả campaign HOAT_DONG còn hạn, mã còn
 * lượt, tối đa một mã cho mỗi campaign. Không có trường min/cap và không có mã
 * targeted trong schema hiện tại — vì vậy route này KHÔNG tự thêm điều kiện,
 * không đọc/ghép dữ liệu admin, và không cần Bearer.
 */
export async function GET() {
  try {
    const upstream = await catalogUpstream("/api/v1/promotions");
    const payload = (await readJson(upstream)) as { success?: boolean; message?: string; result?: unknown } | null;
    if (!upstream.ok || !payload?.success || !Array.isArray(payload.result)) {
      return Response.json(
        { success: false, code: upstream.status || 502, message: "Không tải được ưu đãi đang mở.", result: null },
        { status: upstream.status || 502, headers: { "cache-control": "no-store" } },
      );
    }
    return Response.json(
      { success: true, code: 200, message: "OK", result: payload.result },
      { headers: { "cache-control": "no-store" } },
    );
  } catch {
    return jsonError("Không kết nối được máy chủ ưu đãi.", 503);
  }
}
