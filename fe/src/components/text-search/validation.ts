// Client-side input validation for the TEXT workbench (free text + K).
// Pure helpers so node --test can cover the exact limits the UI enforces.
// Server re-validates everything; these messages are UX guidance only.

export const MAX_TEXT_CODE_POINTS = 1024;
export const MIN_K = 1;
export const MAX_K = 100;

export function codePointCount(text: string): number {
  return Array.from(text).length;
}

/** NFC + Unicode-whitespace collapse, mirroring the backend model view. */
export function modelView(raw: string): string {
  return raw.normalize("NFC").replace(/\s+/gu, " ").trim();
}

export interface TextInput {
  text: string;
  k: number;
}

export function validateTextInput(input: TextInput): string | null {
  if (codePointCount(input.text) > MAX_TEXT_CODE_POINTS) {
    return "Mô tả tìm kiếm tối đa 1024 ký tự.";
  }
  if (modelView(input.text).length === 0) {
    return "Nhập mô tả sản phẩm muốn tìm, ví dụ “váy đỏ”.";
  }
  if (!Number.isInteger(input.k) || input.k < MIN_K || input.k > MAX_K) {
    return "Số kết quả K phải từ 1 đến 100.";
  }
  return null;
}
