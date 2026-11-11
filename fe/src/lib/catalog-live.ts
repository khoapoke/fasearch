/**
 * Hằng số + quyết định thuần cho tìm kiếm trực tiếp trong danh sách (không React/DOM).
 */

/** 400–500ms: đủ để gom nhịp gõ, vẫn thấy phản hồi tức thời. */
export const KEYWORD_DEBOUNCE_MS = 500;
/** Chỉ hiện skeleton khi chưa có dữ liệu và đã chờ lâu hơn ngưỡng này. */
export const SLOW_LOAD_MS = 250;

/** Có nên hẹn một lần commit từ khóa? Không khi trùng đã commit hoặc đang soạn IME. */
export function shouldDebounceKeyword(typed: string, committed: string, composing: boolean): boolean {
  return !composing && typed !== committed;
}

/**
 * Hàng hiển thị của danh sách radio rút gọn: `limit` hàng đầu, nhưng hàng đang
 * chọn LUÔN nằm trong tập hiển thị (không bao giờ chọn mà không thấy).
 */
export function visibleWithActive<T>(items: readonly T[], limit: number, isActive: (item: T) => boolean, expanded: boolean): T[] {
  if (expanded || items.length <= limit) return [...items];
  const head = items.slice(0, limit);
  if (head.some(isActive)) return head;
  const active = items.find(isActive);
  return active ? [...head, active] : head;
}
