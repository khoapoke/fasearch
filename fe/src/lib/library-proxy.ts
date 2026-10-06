// Pure own-library proxy allowlist: only the frozen library paths are
// forwarded; everything else fails closed so the /api/me route can never
// become an open proxy into other backend namespaces.

const ALLOWED_ROOTS = new Set(["saved-products", "search-history", "library-preferences"]);
const SEGMENT = /^[A-Za-z0-9_.:-]{1,128}$/;

export function libraryBackendPath(
  segments: string[] | undefined,
  search: string,
): string | null {
  const parts = segments ?? [];
  if (parts.length === 0 || parts.length > 2) return null;
  if (!ALLOWED_ROOTS.has(parts[0])) return null;
  for (const segment of parts) {
    if (!SEGMENT.test(segment)) return null;
  }
  // library-preferences takes no sub-resource; saved-products takes at most
  // one product id; search-history takes at most one entry id.
  if (parts[0] === "library-preferences" && parts.length !== 1) return null;
  return `/api/v1/me/${parts.map(encodeURIComponent).join("/")}${search}`;
}
