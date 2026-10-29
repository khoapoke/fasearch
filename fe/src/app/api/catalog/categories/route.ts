import { catalogUpstream, jsonError, readJson } from "@/lib/catalog-upstream";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const upstream = await catalogUpstream("/api/v1/categories");
    const payload = (await readJson(upstream)) as { success?: boolean; message?: string } | null;
    if (!upstream.ok || !payload?.success) {
      return Response.json(payload ?? { success: false, code: upstream.status, message: "Không tải được danh mục.", result: null }, { status: upstream.status || 502 });
    }
    return Response.json(payload, { status: upstream.status });
  } catch {
    return jsonError("Không kết nối được máy chủ danh mục.", 503);
  }
}
