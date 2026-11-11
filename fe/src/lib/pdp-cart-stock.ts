import { CommerceError, STOCK_OUT_MESSAGE } from "./customer-commerce.ts";

/**
 * Giỏ đã giữ hết tồn (Part B): biết số lượng SKU đang chọn đã có trong giỏ,
 * kẹp stepper, và báo bị từ chối INSUFFICIENT_STOCK bằng cảnh báo rõ ràng
 * thay vì dòng chữ xám "tạm hết hàng".
 */

/** Chỉ danh mục giày mới đếm bằng "đôi"; còn lại là "sản phẩm". */
export function cartUnitForCategory(categoryName: string | null | undefined): "đôi" | "sản phẩm" {
  if (categoryName && /giày|shoe/i.test(categoryName)) return "đôi";
  return "sản phẩm";
}

/** Tồn còn có thể thêm = available − inCart; null khi chưa rõ tồn. */
export function remainingForSku(
  available: number | null | undefined,
  inCart: number,
): number | null {
  if (available === null || available === undefined) return null;
  return available - Math.max(0, Math.floor(inCart));
}

/**
 * Lỗi thêm giỏ có phải do chạm trần tồn không. Máy chủ chỉ trả về thông điệp
 * tiếng Việt đã chuẩn hóa (STOCK_OUT_MESSAGE hoặc "Chỉ còn N sản phẩm…").
 */
export function isStockShortageFailure(failure: unknown): boolean {
  if (!(failure instanceof CommerceError)) return false;
  // BE envelope (ApiResponse.code số, message "Insufficient stock…") được FE
  // chuẩn hoá thành STOCK_OUT_MESSAGE; giữ thêm mã tên cho tương thích sau này.
  if (failure.code === "INSUFFICIENT_STOCK" || failure.message === "INSUFFICIENT_STOCK") return true;
  const message = failure.message;
  if (message === STOCK_OUT_MESSAGE) return true;
  return /^Chỉ còn \d+ sản phẩm cho lựa chọn này/.test(message);
}

/** Câu cảnh báo khi máy chủ từ chối vì giỏ đã giữ hết tồn. */
export function cartStockAlertText(args: {
  size: string | null;
  available: number | null | undefined;
  inCart: number;
  unit: "đôi" | "sản phẩm";
}): string {
  const { size, available, inCart, unit } = args;
  const head = size ? `Size ${size}` : "Lựa chọn này";
  if (available === null || available === undefined) {
    return `${head} đã chạm mức tồn hiện có — giỏ của bạn đã có đủ rồi.`;
  }
  if (inCart >= available) {
    return `${head} chỉ còn ${available} ${unit} và giỏ của bạn đã có đủ ${available} rồi.`;
  }
  return `${head} chỉ còn ${available} ${unit} — bạn giảm số lượng rồi thử lại nhé.`;
}
