/**
 * Pure rules for the product CSV import screen: file pre-checks, the "same file as the clean
 * dry run" guard, error pagination and the human count line. The network side lives in
 * admin-csv-import-client.ts so both can be tested without a browser.
 */

export const IMPORT_MAX_FILE_BYTES = 5 * 1024 * 1024;
export const IMPORT_MAX_ROWS = 10_000;
export const IMPORT_ERROR_PAGE_SIZE = 20;

export const IMPORT_HEADERS = [
  "Tên sản phẩm",
  "Danh mục",
  "Thương hiệu",
  "Model",
  "Chất liệu",
  "Kiểu dáng",
  "Giá bán",
  "Màu",
  "Cỡ",
  "Mã vạch",
  "Giá cộng thêm",
] as const;

export type CsvRowError = { row: number; column: string; code: string; message: string };
export type CsvImportDraft = { draftId: number; productName: string; skuCount: number };
export type CsvImportResult = {
  checksum: string;
  totalRows: number;
  validRows: number;
  productCount: number;
  errorCount: number;
  truncated?: boolean;
  errors: CsvRowError[];
  drafts?: CsvImportDraft[];
};

type FileFacts = { name: string; size: number; type?: string; lastModified?: number };

const CSV_TYPES = new Set([
  "text/csv",
  "application/csv",
  "application/vnd.ms-excel",
  "text/plain",
  "application/octet-stream",
]);

/** Changes whenever the chosen file changes, so an old clean run cannot authorise a new file. */
export function fileFingerprint(file: FileFacts): string {
  return `${file.name}|${file.size}|${file.lastModified ?? 0}`;
}

/** Client-side version of the server checks, with the same Vietnamese wording. */
export function precheckCsvFile(file: FileFacts): string | null {
  if (!file.name.toLowerCase().endsWith(".csv")) {
    return "Chỉ nhận tệp có phần mở rộng .csv.";
  }
  if (file.size === 0) {
    return "Tệp đang trống. Tải tệp mẫu, điền dữ liệu rồi chọn lại.";
  }
  if (file.size > IMPORT_MAX_FILE_BYTES) {
    return "Tệp vượt quá 5 MB. Chia nhỏ tệp rồi thử lại.";
  }
  const type = (file.type ?? "").split(";")[0].trim().toLowerCase();
  if (type && !CSV_TYPES.has(type)) {
    return "Tệp không phải CSV. Chọn tệp .csv được lưu dưới dạng \"CSV UTF-8\".";
  }
  return null;
}

/**
 * "Nhập" is enabled only for a clean dry run of the very same file. Applying the same file
 * again would be refused by the server (duplicate drafts), so the screen asks for a new check.
 */
export function canApplyCsv(
  result: CsvImportResult | null,
  currentFingerprint: string,
  checkedFingerprint: string,
): boolean {
  if (!result || !currentFingerprint || currentFingerprint !== checkedFingerprint) return false;
  return result.errorCount === 0 && /^[0-9a-f]{64}$/i.test(result.checksum);
}

export function pagedImportErrors(
  errors: CsvRowError[],
  page: number,
  size = IMPORT_ERROR_PAGE_SIZE,
): { rows: CsvRowError[]; page: number; totalPages: number } {
  const totalPages = Math.max(1, Math.ceil(errors.length / size));
  const current = Math.min(Math.max(0, page), totalPages - 1);
  return { rows: errors.slice(current * size, current * size + size), page: current, totalPages };
}

export function importSummary(result: CsvImportResult): string {
  const base = `${result.totalRows} dòng · ${result.validRows} hợp lệ · ${result.productCount} sản phẩm`;
  if (result.errorCount === 0) return `${base} · không có lỗi`;
  return `${base} · ${result.errorCount} lỗi`;
}

/** Drafts created by an import open in the existing draft screen, not a second editor. */
export function draftHref(draftId: number): string {
  return `/quan-tri/san-pham/nhap/${draftId}`;
}
