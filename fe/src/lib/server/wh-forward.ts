// Pure header helpers for the warehouse proxy (unit-testable).
// 18084 hangs on ANY Accept-Language (isolated per-header with curl), and
// undici fetch always sends `Accept-Language: *` (forbidden header — delete
// is ignored). The wh route therefore uses node:http with these helpers.

const HOP_RESPONSE = new Set([
  "connection",
  "content-length",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
]);

/** Upstream request headers: shared builder minus Accept-Language. */
export function whRequestHeaders(
  build: (incoming: Headers, session?: string) => Headers,
  incoming: Headers,
  session?: string,
): Headers {
  const headers = build(incoming, session);
  headers.delete("accept-language");
  return headers;
}

/** Response headers to preserve: content-type + set-cookie + location. */
export function whResponseHeaders(upstream: Record<string, string | string[] | undefined>): {
  contentType?: string;
  cookies: string[];
  location?: string;
} {
  const out: { contentType?: string; cookies: string[]; location?: string } = { cookies: [] };
  for (const [key, value] of Object.entries(upstream)) {
    const name = key.toLowerCase();
    if (HOP_RESPONSE.has(name)) continue;
    if (name === "content-type" && typeof value === "string") out.contentType = value;
    else if (name === "set-cookie") out.cookies = Array.isArray(value) ? value : value ? [value] : [];
    else if (name === "location" && typeof value === "string") out.location = value;
  }
  return out;
}

/** Parse a backend base URL into transport parts (http/https aware). */
export function parseBackendBase(base: string): { protocol: "http:" | "https:"; host: string; port: number } {
  const url = new URL(base.endsWith("/") ? base : `${base}/`);
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error("backend protocol must be http(s)");
  return {
    protocol: url.protocol,
    host: url.hostname,
    port: Number(url.port || (url.protocol === "https:" ? "443" : "80")),
  };
}
