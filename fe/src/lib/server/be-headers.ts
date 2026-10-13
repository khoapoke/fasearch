// Header builder dùng chung cho proxy FE → BE (session-only transport).
// Tách riêng để unit-test được (route.ts chỉ gọi hàm này).

const HOP_BY_HOP = new Set([
  "connection",
  "content-length",
  "expect",
  "host",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
]);

/**
 * Dựng headers gửi upstream: giữ nguyên headers của client trừ hop-by-hop,
 * cookie gốc và content-length; cookie session được dựng lại DUY NHẤT từ
 * FASEARCH_SESSION; F3: KHÔNG BAO GIỜ forward `Authorization` (BE session-only,
 * tránh nhầm lẫn credential tương lai).
 */
export function buildUpstreamHeaders(
  incoming: Headers,
  sessionCookieValue?: string,
): Headers {
  const headers = new Headers();
  incoming.forEach((value, key) => {
    const name = key.toLowerCase();
    if (HOP_BY_HOP.has(name) || name === "cookie" || name === "content-length") return;
    if (name === "authorization") return;
    headers.set(key, value);
  });
  if (sessionCookieValue) headers.set("cookie", `FASEARCH_SESSION=${sessionCookieValue}`);
  return headers;
}
