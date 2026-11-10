// Pure helpers cho demo tìm chữ AI (browser-facing contract trong
// .agent/tasks/ai-text-demo-slice/CONTRACT.md). BE giữ nguyên envelope
// ApiResponse { success, code, message, result, errors }.

export type AiHit = {
  /** Mã điểm vector (khóa ổn định cho UI, không hiển thị). */
  sourceId: string;
  /** Độ tương đồng thô; không hiển thị cho khách. */
  score: number;
  /** Sản phẩm thật đang bán trong danh mục. */
  productId: number;
  name: string;
  brandName: string | null;
  price: number;
  /** Ảnh chính theo catalog (`/api/catalog/product-images/...`) hoặc null. */
  imageUrl: string | null;
  /** Tên các màu còn hàng. */
  colors: string[];
};

/** strip rồi kiểm tra độ dài 1..200. Trả chuỗi đã strip, ném lỗi VI nếu sai. */
export function validateQuery(raw: string): string {
  const query = raw.trim();
  if (!query) throw new Error("Nhập từ khóa tìm kiếm (1–200 ký tự).");
  if ([...query].length > 200) throw new Error("Từ khóa quá dài (tối đa 200 ký tự). Rút gọn rồi thử lại.");
  return query;
}

/** int 1..24, default 12. Nhận string từ input. */
export function validateLimit(raw: string): number {
  if (!raw.trim()) return 12;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1 || n > 24) {
    throw new Error("Số kết quả phải là số nguyên 1–24.");
  }
  return n;
}

type RawHit = {
  sourceId?: unknown;
  score?: unknown;
  productId?: unknown;
  name?: unknown;
  brandName?: unknown;
  price?: unknown;
  imageUrl?: unknown;
  colors?: unknown;
};

/** Chỉ nhận ảnh sản phẩm catalog qua BFF cùng origin, tên file an toàn. */
export function toCatalogImageUrl(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const prefix = "/api/catalog/product-images/";
  if (!raw.startsWith(prefix) || raw.length > 512) return null;
  const rest = raw.slice(prefix.length);
  if (!rest || rest.includes("..") || rest.includes("\\") || rest.includes("?") || rest.includes("#")) return null;
  return /^[A-Za-z0-9._\-/%]+$/.test(rest) ? raw : null;
}

/**
 * Bóc result.results từ envelope BFF. Giữ đúng thứ tự upstream; mỗi kết quả là sản phẩm thật
 * (productId nguyên dương, tên, giá hữu hạn); điểm chỉ để xếp hạng nội bộ.
 */
export function parseAiResults(payload: unknown): AiHit[] {
  const envelope = payload as { result?: { results?: unknown } };
  const results = envelope?.result?.results;
  if (!Array.isArray(results)) {
    throw new Error("Máy chủ trả về không đúng định dạng. Thử lại.");
  }
  return results.map((item) => {
    const raw = item as RawHit;
    if (typeof raw.sourceId !== "string" || !raw.sourceId) {
      throw new Error("Máy chủ trả về không đúng định dạng. Thử lại.");
    }
    if (typeof raw.score !== "number" || !Number.isFinite(raw.score)) {
      throw new Error("Máy chủ trả về điểm số không hợp lệ. Thử lại.");
    }
    if (typeof raw.productId !== "number" || !Number.isInteger(raw.productId) || raw.productId < 1
      || typeof raw.name !== "string" || !raw.name.trim()
      || typeof raw.price !== "number" || !Number.isFinite(raw.price)) {
      throw new Error("Máy chủ trả về không đúng định dạng. Thử lại.");
    }
    return {
      sourceId: raw.sourceId,
      score: raw.score,
      productId: raw.productId,
      name: raw.name.trim(),
      brandName: typeof raw.brandName === "string" && raw.brandName ? raw.brandName : null,
      price: raw.price,
      imageUrl: toCatalogImageUrl(raw.imageUrl),
      colors: Array.isArray(raw.colors) ? raw.colors.filter((c): c is string => typeof c === "string" && c.length > 0) : [],
    };
  });
}
