import type { NextRequest } from "next/server";
import { requireJsonPost, authError, readJsonObject } from "@/lib/server/customer-auth";
import { catalogWrite } from "@/lib/server/admin-catalog";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function denylistHost(host: string): boolean {
  const h = host.toLowerCase().replace(/\.$/, "");
  if (h === "localhost" || h.endsWith(".localhost")) return true;
  if (h === "[::1]" || h === "::1") return true;
  if (/^(127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|169\.254\.|0\.0\.0\.0)/.test(h)) return true;
  if (/^(metadata|instance-data|wpad|proxy|gateway|router|host)\./.test(h)) return true;
  return false;
}

/**
 * Nhập URL có hỗ trợ (tùy chọn): BE kiểm tra allowlist/redirect/IP/kích thước,
 * ánh xạ ID nguồn/variant/provenance chính xác. Lỗi fetch giữ nguyên form thủ công.
 */
export async function POST(request: NextRequest) {
  const guard = requireJsonPost(request);
  if (guard) return guard;
  const parsed = await readJsonObject(request);
  if (!parsed.ok) return parsed.response;
  const { url } = parsed.body;
  if (typeof url !== "string" || !url.trim() || url.trim().length > 2048) {
    return authError("URL chưa hợp lệ.", 400);
  }
  let host = "";
  try {
    const u = new URL(url.trim());
    if (u.protocol !== "http:" && u.protocol !== "https:") return authError("Chỉ hỗ trợ URL http/https.", 400);
    host = u.hostname;
  } catch {
    return authError("URL chưa hợp lệ.", 400);
  }
  if (denylistHost(host)) return authError("URL nội bộ/bảo mật không được phép.", 400, "URL_DENIED");
  return catalogWrite(request, "/api/v1/admin/products/import-url", "POST", { url: url.trim() });
}
