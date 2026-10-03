// Client-side input validation for the live composed workbench (UPLOAD-first).
// Pure helpers so node --test can cover the exact limits the UI enforces.
// Server re-validates everything; these messages are UX guidance only.

export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
export const MAX_TEXT_CODE_POINTS = 1024;
export const MIN_K = 1;
export const MAX_K = 100;

const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export function codePointCount(text: string): number {
  return Array.from(text).length;
}

/** NFC + Unicode-whitespace collapse, mirroring the backend model view. */
export function modelView(raw: string): string {
  return raw.normalize("NFC").replace(/\s+/gu, " ").trim();
}

export interface ComposedInput {
  file: File | null;
  text: string;
  k: number;
}

export function validateComposedInput(input: ComposedInput): string | null {
  if (!input.file) {
    return "Chọn ảnh JPEG, PNG hoặc WebP để làm ảnh tham chiếu.";
  }
  if (!ALLOWED_TYPES.has(input.file.type)) {
    return "Chọn ảnh JPEG, PNG hoặc WebP.";
  }
  if (input.file.size === 0) {
    return "Ảnh đang trống. Hãy chọn một tệp khác.";
  }
  if (input.file.size > MAX_IMAGE_BYTES) {
    return "Ảnh phải nhỏ hơn hoặc bằng 10 MiB.";
  }
  if (codePointCount(input.text) > MAX_TEXT_CODE_POINTS) {
    return "Mô tả thay đổi tối đa 1024 ký tự.";
  }
  if (modelView(input.text).length === 0) {
    return "Nhập mô tả thay đổi mong muốn, ví dụ “đổi sang màu navy”.";
  }
  if (!Number.isInteger(input.k) || input.k < MIN_K || input.k > MAX_K) {
    return "Số kết quả K phải từ 1 đến 100.";
  }
  return null;
}
