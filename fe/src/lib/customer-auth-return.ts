// Legacy /tai-khoan/*, /kenh-ban/* and /quan-tri/* routes depend on the old
// FASEARCH_SESSION; this exact promotions route has its own ADMIN-only JWT BFF.
const FALLBACK = "/tai-khoan";
const TARGETS = new Set(["/", "/tai-khoan", "/gio-hang", "/thanh-toan", "/don-hang", "/quan-tri", "/quan-tri/khuyen-mai", "/quan-tri/don-hang", "/quan-tri/san-pham", "/quan-tri/danh-muc", "/quan-tri/ton-kho", "/quan-tri/phieu-nhap", "/quan-tri/phieu-nhap/moi", "/quan-tri/phieu-xuat", "/quan-tri/kiem-ke", "/quan-tri/kiem-ke/moi", "/tim-kiem-ai", "/nam", "/quan-tri/khach-hang", "/quan-tri/khach-hang/moi", "/quan-tri/nhan-vien", "/quan-tri/nhan-vien/moi", "/quan-tri/tai-khoan-noi-bo"]);

function hasControlChar(value: string): boolean {
  for (const char of value) {
    const code = char.codePointAt(0) ?? 0;
    if (code <= 0x1f || code === 0x7f) return true;
  }
  return false;
}

export function safeCustomerAuthReturn(raw: string | null): string {
  if (!raw || raw.length > 256) return FALLBACK;
  if (!raw.startsWith("/") || raw.startsWith("//") || raw.includes("\\") || raw.includes("?") || raw.includes("#") || hasControlChar(raw)) {
    return FALLBACK;
  }
  let decoded = raw;
  for (let round = 0; round < 3; round++) {
    let next: string;
    try {
      next = decodeURIComponent(decoded);
    } catch {
      return FALLBACK;
    }
    if (next === decoded) break;
    decoded = next;
  }
  // Encoded targets are ambiguous; only the plain exact targets are allowed.
  const ownedOrder = /^\/don-hang\/[1-9]\d*$/.test(decoded);
  const adminOrder = /^\/quan-tri\/don-hang\/[1-9]\d*$/.test(decoded);
  const adminCatalog = /^\/quan-tri\/san-pham\/(new|[1-9]\d*)(\/sua)?$/.test(decoded);
  const adminStock = /^\/quan-tri\/ton-kho\/[1-9]\d*$/.test(decoded);
  const adminImport = /^\/quan-tri\/phieu-nhap\/[1-9]\d*$/.test(decoded);
  const adminExport = /^\/quan-tri\/phieu-xuat\/[1-9]\d*$/.test(decoded);
  const adminStocktake = /^\/quan-tri\/kiem-ke\/[1-9]\d*$/.test(decoded);
  const adminCustomer = /^\/quan-tri\/khach-hang\/[1-9]\d*$/.test(decoded);
  const adminEmployee = /^\/quan-tri\/nhan-vien\/[1-9]\d*$/.test(decoded);
  const customerProduct = /^\/san-pham\/[1-9]\d*$/.test(decoded);
  if (decoded !== raw || (!TARGETS.has(decoded) && !ownedOrder && !adminOrder && !adminCatalog && !adminStock && !adminImport && !adminExport && !adminStocktake && !adminCustomer && !adminEmployee && !customerProduct)) return FALLBACK;
  return decoded;
}
