// Pure helpers cho demo tìm chữ AI (browser-facing contract trong
// .agent/tasks/ai-text-demo-slice/CONTRACT.md). BE giữ nguyên envelope
// ApiResponse { success, code, message, result, errors }.

export type AiHit = {
  sourceId: string;
  score: number;
  fileName: string;
  catalog: string | null;
  /** Same-origin proxy path `/api/be/v1/ai/images/{id}`, null khi vắng/không hợp lệ. */
  imageUrl: string | null;
  tenHienThi: string | null;
  thuocTinh: unknown;
  nguonDuLieu: string | null;
  phienBanDuLieu: string | null;
  maSpLienKet: string | number | null;
};

/** strip rồi kiểm tra độ dài 1..200. Trả chuỗi đã strip, ném lỗi VI nếu sai. */
export function validateQuery(raw: string): string {
  const query = raw.trim();
  if (!query) throw new Error("Nhập từ khóa tìm kiếm (1–200 ký tự).");
  if ([...query].length > 200) throw new Error("Từ khóa quá dài (tối đa 200 ký tự). Rút gọn rồi thử lại.");
  return query;
}

/** int 1..5, default 5. Nhận string từ input. */
export function validateLimit(raw: string): number {
  if (!raw.trim()) return 5;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1 || n > 5) {
    throw new Error("Số kết quả phải là số nguyên 1–5.");
  }
  return n;
}

type RawHit = {
  sourceId?: unknown;
  id?: unknown;
  score?: unknown;
  fileName?: unknown;
  file_name?: unknown;
  catalog?: unknown;
  imageUrl?: unknown;
  tenHienThi?: unknown;
  thuocTinh?: unknown;
  nguonDuLieu?: unknown;
  phienBanDuLieu?: unknown;
  maSpLienKet?: unknown;
};


/**
 * BE imageUrl là BE-relative (`/api/v1/ai/images/{sourceId}`), KHÔNG phải URL
 * browser. Validate khớp đúng endpoint đã duyệt rồi chuyển đúng một lần sang
 * same-origin proxy `/api/be/...` (proxy catch-all forward session + binary).
 * Từ chối: URL ngoài, path lạ, traversal (thô/mã hóa), remainder rỗng.
 * Vắng/null → null (placeholder trung thực), không ném.
 */
export function toProxyImageUrl(raw: unknown): string | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw !== "string" || !raw.startsWith("/api/ai/image?path=")) return null;
  const encoded = raw.slice("/api/ai/image?path=".length);
  if (!encoded || encoded.length > 512) return null;
  let path: string;
  try { path = decodeURIComponent(encoded); } catch { return null; }
  if (!path.startsWith("/dataset/") && !path.startsWith("/uploads/") && !path.startsWith("/api/v1/search/images/")) return null;
  if (path.includes("\\") || path.includes("..") || path.includes("//")) return null;
  return raw;
}

/**
 * Bóc data.results từ envelope BE. Giữ đúng thứ tự upstream; score phải finite
 * (điểm tương đồng, không phải %/accuracy); catalog null khi vắng/không phải
 * string. Alias id/file_name theo schema teammate phòng BE giữ nguyên tên.
 */
export function parseAiResults(payload: unknown): AiHit[] {
  const envelope = payload as { result?: { results?: unknown } };
  const results = envelope?.result?.results;
  if (!Array.isArray(results)) {
    throw new Error("Máy chủ trả về không đúng định dạng. Thử lại.");
  }
  return results.map((item) => {
    const raw = item as RawHit;
    const sourceId = raw.sourceId ?? raw.id;
    const fileName = raw.fileName ?? raw.file_name;
    if (typeof sourceId !== "string" || !sourceId) {
      throw new Error("Máy chủ trả về không đúng định dạng. Thử lại.");
    }
    if (typeof raw.score !== "number" || !Number.isFinite(raw.score)) {
      throw new Error("Máy chủ trả về điểm số không hợp lệ. Thử lại.");
    }
    return {
      sourceId,
      score: raw.score,
      fileName: typeof fileName === "string" ? fileName : "—",
      catalog: typeof raw.catalog === "string" && raw.catalog ? raw.catalog : null,
      imageUrl: toProxyImageUrl(raw.imageUrl),
      tenHienThi: typeof raw.tenHienThi === "string" && raw.tenHienThi ? raw.tenHienThi : null,
      thuocTinh: raw.thuocTinh ?? null,
      nguonDuLieu: typeof raw.nguonDuLieu === "string" && raw.nguonDuLieu ? raw.nguonDuLieu : null,
      phienBanDuLieu: typeof raw.phienBanDuLieu === "string" && raw.phienBanDuLieu ? raw.phienBanDuLieu : null,
      maSpLienKet:
        typeof raw.maSpLienKet === "string" || typeof raw.maSpLienKet === "number"
          ? raw.maSpLienKet
          : null,
    };
  });
}
