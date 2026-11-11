// Pure AI full-corpus helpers (CONTRACT.md AI public API).
// Không fetch — validation file ảnh, bounds, status phân biệt, metadata honesty.

export type AiMode = "text" | "image" | "composed";

export type AiDatasetMeta = {
  sourceId: string;
  score: number;
  fileName: string;
  catalog?: string | null;
  imageUrl: string | null;
  tenHienThi?: string | null;
  thuocTinh?: unknown;
  nguonDuLieu?: string | null;
  phienBanDuLieu?: string | null;
  maSpLienKet?: number | string | null;
};

export type AiStatus = {
  ready: boolean;
  modeCapabilities: string[];
  datasetVersion: string | null;
  eligibleImageCount: number | null;
  publicationVersion: string | null;
};

export const AI_MAX_BYTES = 5 * 1024 * 1024;
export const AI_MAX_DIM = 4000;

export function validateImageFile(file: File): void {
  const type = file.type.toLowerCase();
  if (type !== "image/jpeg" && type !== "image/png") {
    throw new Error("Chỉ nhận ảnh JPEG/PNG thật (quy định máy chủ).");
  }
  if (file.size <= 0) throw new Error("Tệp ảnh rỗng.");
  if (file.size > AI_MAX_BYTES) throw new Error("Ảnh vượt quá 5MiB. Chọn ảnh nhỏ hơn rồi thử lại.");
}

/** Decode thực để kiểm tra ≤4000×4000 trước inference đắt tiền. */
export function checkImageDimensions(width: number, height: number): void {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    throw new Error("Không đọc được kích thước ảnh. Chọn ảnh JPEG/PNG khác.");
  }
  if (width > AI_MAX_DIM || height > AI_MAX_DIM) {
    throw new Error(`Ảnh ${Math.round(width)}×${Math.round(height)} vượt quá 4000×4000 pixel của máy chủ.`);
  }
}

export function validateComposed(query: string, file: File | null): { q: string } {
  if (!file) throw new Error("Chế độ kết hợp cần 1 ảnh JPEG/PNG ≤5MiB.");
  validateImageFile(file);
  const q = query.trim();
  if (!q) throw new Error("Chế độ kết hợp cần từ khóa 1–200 ký tự kèm ảnh.");
  if ([...q].length > 200) throw new Error("Từ khóa quá dài (tối đa 200 ký tự).");
  return { q };
}

export function describeAiStatus(status: AiStatus | null): string {
  if (!status) return "Chưa tải được trạng thái AI.";
  if (!status.ready) return "AI chưa sẵn sàng (đang index/thiếu publication/timeout). Giao dịch vẫn chạy độc lập.";
  const n = status.eligibleImageCount;
  if (n === 0) return "AI đã sẵn sàng nhưng chưa có kết quả phù hợp (tập rỗng hợp lệ — khác với index chưa build).";
  return `AI sẵn sàng · ${n ?? "—"} ảnh đủ điều kiện · bản dữ liệu ${status.datasetVersion ?? "—"}.`;
}

export function isPurchasable(hit: AiDatasetMeta): boolean {
  return hit.maSpLienKet !== null && hit.maSpLienKet !== undefined && String(hit.maSpLienKet).trim() !== "";
}

export function datasetKindLabel(nguonDuLieu: string | null | undefined): string {
  if (!nguonDuLieu) return "Tập dữ liệu AI (nguồn chưa công bố)";
  return `Nguồn dữ liệu: ${nguonDuLieu}`;
}
