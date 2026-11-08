import type { NextRequest } from "next/server";
import { readJsonObject } from "@/lib/server/customer-auth";

const BE = process.env.FASEARCH_BACKEND_URL?.replace(/\/+$/, "") || "http://127.0.0.1:18126";
const MAX_FILE = 5 * 1024 * 1024;
const MAX_QUERY = 200;

type UpstreamItem = { id?: unknown; score?: unknown; productId?: unknown; productName?: unknown; brandName?: unknown; price?: unknown; imageUrl?: unknown; colors?: unknown };
type Upstream = { success?: boolean; message?: string; result?: { total?: unknown; items?: unknown } };

function jsonError(message: string, status: number, code = "AI_SEARCH_ERROR") {
  return Response.json({ success: false, code, message, result: null }, { status, headers: { "cache-control": "no-store" } });
}

/** Ảnh sản phẩm catalog: BE trả `/api/v1/products/images/{file}`, FE phục vụ qua BFF cùng origin. */
function catalogImage(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const m = raw.match(/^\/api\/v1\/products\/images\/([A-Za-z0-9._-]+)$/);
  return m ? `/api/catalog/product-images/${m[1]}` : null;
}

/** BE đã lọc sản phẩm đang bán + còn hàng; BFF chỉ chuẩn hóa dữ liệu thẻ sản phẩm, không chuyển nhãn kỹ thuật của index AI. */
function normalize(payload: Upstream) {
  const items = Array.isArray(payload.result?.items) ? (payload.result.items as UpstreamItem[]) : [];
  const results = items.map((item) => {
    const sourceId = typeof item.id === "string" ? item.id : "";
    const score = typeof item.score === "number" && Number.isFinite(item.score) ? item.score : null;
    const productId = typeof item.productId === "number" && Number.isInteger(item.productId) && item.productId > 0 ? item.productId : null;
    const name = typeof item.productName === "string" ? item.productName.trim() : "";
    const price = typeof item.price === "number" && Number.isFinite(item.price) ? item.price : null;
    if (!sourceId || score === null || productId === null || !name || price === null) throw new Error("AI_INVALID_RESULT");
    return {
      sourceId, score, productId, name, price,
      brandName: typeof item.brandName === "string" && item.brandName ? item.brandName : null,
      imageUrl: catalogImage(item.imageUrl),
      colors: Array.isArray(item.colors) ? item.colors.filter((c): c is string => typeof c === "string" && c.length > 0) : [],
    };
  });
  return { total: results.length, results };
}

async function forward(path: string, body: BodyInit, headers: Record<string, string>): Promise<Response> {
  try {
    const upstream = await fetch(`${BE}${path}`, { method: "POST", headers: { accept: "application/json", ...headers }, body, cache: "no-store", signal: AbortSignal.timeout(60000) });
    let payload: Upstream | null = null;
    try { payload = (await upstream.json()) as Upstream; } catch {}
    if (!upstream.ok || !payload?.success) return jsonError(payload?.message || "Dịch vụ tìm kiếm AI không khả dụng.", upstream.status || 503, "AI_UPSTREAM_ERROR");
    try { return Response.json({ success: true, code: 200, message: "Tìm kiếm AI thành công", result: normalize(payload) }, { headers: { "cache-control": "no-store" } }); }
    catch { return jsonError("Máy chủ AI trả về kết quả không hợp lệ.", 502, "AI_INVALID_RESULT"); }
  } catch {
    return jsonError("Không kết nối được dịch vụ AI. Thử lại sau.", 503, "AI_UNAVAILABLE");
  }
}

export async function aiSearch(request: NextRequest, mode: string): Promise<Response> {
  if (mode === "text") {
    const parsed = await readJsonObject(request); if (!parsed.ok) return parsed.response;
    const query = typeof parsed.body.query === "string" ? parsed.body.query.trim() : "";
    if (!query || [...query].length > MAX_QUERY) return jsonError("Nhập mô tả 1–200 ký tự.", 400, "INVALID_QUERY");
    const limit = typeof parsed.body.limit === "number" && Number.isInteger(parsed.body.limit) && parsed.body.limit >= 1 && parsed.body.limit <= 24 ? parsed.body.limit : 12;
    return forward("/api/v1/search/text", JSON.stringify({ query, limit }), { "content-type": "application/json" });
  }
  if (mode !== "image" && mode !== "multimodal") return jsonError("Chế độ tìm kiếm chưa hỗ trợ.", 400, "INVALID_MODE");
  let form: FormData;
  try { form = await request.formData(); } catch { return jsonError("Dữ liệu biểu mẫu chưa hợp lệ.", 400, "INVALID_FORM"); }
  const file = form.get("file");
  if (!(file instanceof File) || file.size <= 0) return jsonError("Chọn ảnh JPEG/PNG để tìm kiếm.", 400, "INVALID_IMAGE");
  if (file.size > MAX_FILE) return jsonError("Ảnh vượt quá 5MiB.", 413, "IMAGE_TOO_LARGE");
  if (file.type !== "image/jpeg" && file.type !== "image/png") return jsonError("Chỉ nhận ảnh JPEG/PNG.", 415, "UNSUPPORTED_IMAGE");
  const limitRaw = Number(form.get("limit") ?? 12);
  const limit = Number.isInteger(limitRaw) && limitRaw >= 1 && limitRaw <= 24 ? limitRaw : 12;
  const out = new FormData(); out.append("file", file); out.append("limit", String(limit));
  if (mode === "multimodal") {
    const query = typeof form.get("query") === "string" ? String(form.get("query")).trim() : "";
    if (!query || [...query].length > MAX_QUERY) return jsonError("Nhập mô tả bổ sung 1–200 ký tự.", 400, "INVALID_QUERY");
    const weight = Number(form.get("text_weight") ?? 0.5);
    out.append("query", query); out.append("text_weight", String(Number.isFinite(weight) && weight >= 0 && weight <= 1 ? weight : 0.5));
    return forward("/api/v1/search/multimodal", out, {});
  }
  return forward("/api/v1/search/image", out, {});
}

export async function aiImage(request: NextRequest): Promise<Response> {
  const raw = request.nextUrl.searchParams.get("path") ?? "";
  const prefix = "/api/v1/search/images/";
  if (!raw.startsWith(prefix) || raw.length > 512) return jsonError("Đường dẫn ảnh không hợp lệ.", 400, "INVALID_IMAGE_PATH");
  const fileName = raw.slice(prefix.length);
  if (!fileName || fileName.includes("/") || fileName.includes("\\") || fileName.includes("..") || !/^[A-Za-z0-9._-]+\.(jpg|jpeg|png|webp)$/i.test(fileName)) return jsonError("Đường dẫn ảnh không hợp lệ.", 400, "INVALID_IMAGE_PATH");
  try {
    const upstream = await fetch(`${BE}${raw}`, { method: "GET", cache: "no-store", signal: AbortSignal.timeout(15000) });
    if (!upstream.ok) return jsonError("Không tải được ảnh AI.", upstream.status === 404 ? 404 : 502, "IMAGE_UNAVAILABLE");
    const h = new Headers({ "cache-control": "no-store" });
    const type = upstream.headers.get("content-type"); if (type) h.set("content-type", type);
    return new Response(upstream.body, { status: upstream.status, headers: h });
  } catch { return jsonError("Không kết nối được dịch vụ ảnh AI.", 503, "AI_UNAVAILABLE"); }
}

