// Server-only catalog upstream helpers. Used by narrow GET routes only:
// no cookies, no Authorization, no generic URL passthrough.

const BASE = () => {
  const raw = process.env.FASEARCH_CATALOG_BACKEND_URL;
  if (!raw) throw new Error("catalog upstream not configured");
  return raw.replace(/\/+$/, "");
};

export function catalogBaseUrl(): string {
  return BASE();
}

/** Absolute image URLs are kept; same-origin catalog paths are resolved to the
 * configured catalog origin. Anything else is rejected (no SSRF passthrough). */
export function resolveCatalogImage(raw: unknown): string | null {
  if (typeof raw !== "string" || !raw.trim()) return null;
  const value = raw.trim();
  // Product photos are served through the narrow same-origin AI image BFF;
  // preserve that route instead of rewriting it to the BE origin.
  if (value.startsWith("/api/ai/image?path=")) return value;
  if (/^https?:\/\//i.test(value)) return value;
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return null;
  if (value.split("/").includes("..")) return null;
  try {
    return new URL(value, `${BASE()}/`).toString();
  } catch {
    return null;
  }
}

export async function catalogUpstream(path: string, params?: URLSearchParams): Promise<Response> {
  const base = BASE();
  const qs = params && [...params.keys()].length > 0 ? `?${params.toString()}` : "";
  return fetch(`${base}${path}${qs}`, {
    method: "GET",
    cache: "no-store",
    headers: { accept: "application/json" },
    signal: AbortSignal.timeout(8000),
  });
}

export async function readJson(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export function jsonError(message: string, status: number) {
  return Response.json({ success: false, code: status, message, result: null }, { status });
}
