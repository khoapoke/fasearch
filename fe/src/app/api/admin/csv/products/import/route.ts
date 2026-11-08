import type { NextRequest } from "next/server";
import { adminIdentity } from "@/lib/server/admin-bff";
import { authCookie, authError } from "@/lib/server/customer-auth";
import { BE } from "@/lib/server/admin-catalog";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Multipart overhead on top of the 5 MB file limit enforced by the backend. */
const MAX_BODY_BYTES = 6 * 1024 * 1024;
const CHECKSUM = /^[0-9a-f]{64}$/i;
const OVERSIZE = "Tệp vượt quá giới hạn 5 MB. Chia nhỏ tệp rồi thử lại.";

/**
 * Import a product CSV through the admin BFF. A dry run carries ?dryRun=true; apply carries the
 * checksum returned by a clean dry run, and the backend recomputes it. The body is capped before
 * it is forwarded, and the upstream call is allowed to take longer than the 12-second JSON reads
 * because a valid file may create thousands of drafts in one transaction.
 */
export async function POST(request: NextRequest) {
  const who = await adminIdentity(request);
  if ("response" in who) return who.response;
  const token = authCookie(request);
  if (!token) return authError("Thiếu phiên quản trị.", 401);

  const contentType = request.headers.get("content-type");
  if (!contentType || !contentType.toLowerCase().includes("multipart/form-data")) {
    return authError("Yêu cầu phải là multipart/form-data.", 400);
  }
  const declared = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) {
    return authError(OVERSIZE, 413, "PAYLOAD_TOO_LARGE");
  }

  let body: ArrayBuffer;
  try {
    body = await request.arrayBuffer();
  } catch {
    return authError("Không đọc được tệp tải lên. Chọn lại tệp rồi thử tiếp.", 400);
  }
  if (body.byteLength > MAX_BODY_BYTES) {
    return authError(OVERSIZE, 413, "PAYLOAD_TOO_LARGE");
  }

  const url = new URL(request.url);
  const dryRun = url.searchParams.get("dryRun") === "true";
  const checksum = url.searchParams.get("checksum") ?? "";
  if (!dryRun && !CHECKSUM.test(checksum)) {
    return authError("Thiếu mã kiểm tra từ lần Kiểm tra. Bấm Kiểm tra lại trước khi nhập.", 400,
      "CHECKSUM_REQUIRED");
  }
  const query = dryRun ? "?dryRun=true" : `?checksum=${encodeURIComponent(checksum)}`;

  try {
    const upstream = await fetch(`${BE}/api/v1/admin/csv/products/import${query}`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        accept: "application/json",
        "content-type": contentType,
      },
      body,
      cache: "no-store",
      signal: AbortSignal.any([request.signal, AbortSignal.timeout(120_000)]),
    });
    const headers = new Headers({ "cache-control": "no-store" });
    const type = upstream.headers.get("content-type");
    if (type) headers.set("content-type", type);
    return new Response(upstream.body, { status: upstream.status, headers });
  } catch {
    return authError("Không kết nối được máy chủ để Import CSV.", 503);
  }
}
