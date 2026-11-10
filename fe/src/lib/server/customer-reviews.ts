import type { NextRequest } from "next/server";
import { authCookie } from "@/lib/server/customer-auth";
import { authBackendUrl } from "@/lib/server/be-upstream";

// Narrow same-origin transport for product reviews. Public reads work without a
// session; writes and /me need the HttpOnly JWT, which is only ever sent as Bearer
// to the paired BE (never exposed to the browser).
function timeoutSignal(signal: AbortSignal): AbortSignal {
  return AbortSignal.any([signal, AbortSignal.timeout(12000)]);
}

export type ReviewAuth = "none" | "required";

export async function reviewUpstream(
  request: NextRequest,
  path: string,
  init: { method: "GET" | "POST" | "PUT" | "DELETE"; body?: unknown; auth?: ReviewAuth } = { method: "GET" },
): Promise<Response> {
  const token = authCookie(request);
  if ((init.auth ?? "none") === "required" && !token) {
    return Response.json({ success: false, code: 401, message: "Cần đăng nhập để đánh giá sản phẩm.", result: null }, { status: 401, headers: { "cache-control": "no-store" } });
  }
  const headers: Record<string, string> = { accept: "application/json" };
  if (token) headers.authorization = `Bearer ${token}`;
  if (init.body !== undefined) headers["content-type"] = "application/json";
  let upstream: Response;
  try {
    upstream = await fetch(`${authBackendUrl()}${path}`, {
      method: init.method,
      headers,
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      cache: "no-store",
      redirect: "manual",
      signal: timeoutSignal(request.signal),
    });
  } catch {
    return Response.json({ success: false, code: 503, message: "Không kết nối được máy chủ đánh giá. Thử lại.", result: null }, { status: 503, headers: { "cache-control": "no-store" } });
  }
  const out = new Headers({ "cache-control": "no-store" });
  const type = upstream.headers.get("content-type");
  if (type) out.set("content-type", type);
  return new Response(upstream.status === 204 ? null : upstream.body, { status: upstream.status, headers: out });
}

export function reviewProductId(raw: string): number | null {
  if (!/^\d+$/.test(raw)) return null;
  const n = Number(raw);
  return Number.isSafeInteger(n) && n > 0 ? n : null;
}

const FITS = new Set(["NHO", "VUA", "RONG"]);

/** Whitelist + validate the write payload before it ever reaches the BE. */
export function parseReviewBody(
  body: Record<string, unknown>,
): { ok: true; value: { rating: number; title: string | null; body: string | null; sizeFit: string | null } } | { ok: false; message: string } {
  const rating = body.rating;
  if (typeof rating !== "number" || !Number.isInteger(rating) || rating < 1 || rating > 5) return { ok: false, message: "Vui lòng chọn số sao từ 1 đến 5." };
  const text = (value: unknown, max: number, label: string): { ok: true; value: string | null } | { ok: false; message: string } => {
    if (value === undefined || value === null || value === "") return { ok: true, value: null };
    if (typeof value !== "string") return { ok: false, message: `${label} chưa hợp lệ.` };
    const trimmed = value.trim();
    if (trimmed.length > max) return { ok: false, message: `${label} tối đa ${max} ký tự.` };
    return { ok: true, value: trimmed || null };
  };
  const title = text(body.title, 120, "Tiêu đề");
  if (!title.ok) return title;
  const content = text(body.body, 2000, "Nội dung");
  if (!content.ok) return content;
  const fit = body.sizeFit;
  if (fit !== undefined && fit !== null && (typeof fit !== "string" || !FITS.has(fit))) return { ok: false, message: "Cảm nhận kích cỡ chưa hợp lệ." };
  return { ok: true, value: { rating, title: title.value, body: content.value, sizeFit: (fit as string | null | undefined) ?? null } };
}
