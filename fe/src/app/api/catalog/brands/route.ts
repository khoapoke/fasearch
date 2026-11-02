import { catalogUpstream, jsonError, readJson } from "@/lib/catalog-upstream";

export const dynamic = "force-dynamic";

/** Danh mục thương hiệu công khai của catalog candidate (rỗng khi chưa import). */
export async function GET() {
  try {
    const upstream = await catalogUpstream("/api/v1/brands");
    const payload = (await readJson(upstream)) as { success?: boolean; message?: string; result?: unknown } | null;
    if (!upstream.ok || !payload?.success || !Array.isArray(payload.result)) {
      return Response.json({ success: false, code: upstream.status || 502, message: "Không tải được thương hiệu.", result: [] }, { status: upstream.status || 502, headers: { "cache-control": "no-store" } });
    }
    return Response.json({ success: true, code: 200, message: "OK", result: payload.result }, { headers: { "cache-control": "no-store" } });
  } catch {
    return jsonError("Không kết nối được máy chủ catalog.", 503);
  }
}
