/**
 * R5: phân loại biến thể trung thực — tách khỏi detail-view để kiểm thử biên trực tiếp.
 *
 * Quy tắc:
 * - Giá trị placeholder của nhà cung cấp ("Default Title", "Không xác định", …)
 *   KHÔNG phải lựa chọn của khách — bị ẩn, không thành pill.
 * - Chiều thực duy nhất (một màu thật / một cỡ thật) tự giải quyết nội bộ,
 *   không bắt khách bấm cho có.
 * - Ngược lại khách phải chọn đủ chiều thật; SKU chỉ khớp khi ứng viên DUY NHẤT —
 *   không bao giờ `.find` tùy tiện trên nhiều ứng viên.
 * - Nhiều SKU mà mọi chiều đều là placeholder ⇒ mơ hồ thật: không đoán SKU,
 *   trả về trạng thái unavailable trung thực.
 */

export type VariantLike = {
  skuId: number;
  productId: number;
  color: string | null;
  size: string | null;
  additionalPrice: number;
  /** Cờ BE khi có (true = placeholder chắc chắn; false = thật chắc chắn). */
  colorIsSentinel?: boolean | null;
  sizeIsSentinel?: boolean | null;
};

const PLACEHOLDERS = new Set([
  "",
  "default title",
  "default",
  "unknown",
  "n/a",
  "không xác định",
  "khong xac dinh",
]);

/** true khi giá trị không phải lựa chọn thật (null/rỗng/sentinel của feed). */
export function isPlaceholder(value: string | null): boolean {
  if (value === null) return true;
  return PLACEHOLDERS.has(value.trim().toLowerCase());
}

/** Như trên nhưng ưu tiên cờ BE khi có — không suy đoán thêm ngoài hợp đồng. */
export function isSentinel(value: string | null, flag?: boolean | null): boolean {
  if (flag === true) return true;
  if (flag === false) return false;
  return isPlaceholder(value);
}

/** true khi một biến thể không còn chiều thật nào (ví dụ 3124 hôm nay). */
export function isFullySentinel(variant: VariantLike): boolean {
  return isSentinel(variant.color, variant.colorIsSentinel) && isSentinel(variant.size, variant.sizeIsSentinel);
}

function uniqueReal(values: Array<string | null>): string[] {
  return [...new Set(values.filter((v): v is string => v !== null && !isPlaceholder(v)))];
}

export type Selection = {
  /** Các chiều thật còn lại sau khi ẩn placeholder. */
  colors: string[];
  sizes: string[];
  /** Giá trị hiệu dụng: lựa chọn của khách, hoặc tự giải khi chiều chỉ còn một. */
  effColor: string;
  effSize: string;
  /** Các SKU khớp với (các) chiều hiệu dụng. */
  candidates: VariantLike[];
  /** SKU được chọn — chỉ khi DUY NHẤT một ứng viên. */
  selected: VariantLike | undefined;
  /** true khi khách còn một lựa chọn thật bắt buộc phải bấm. */
  needColor: boolean;
  needSize: boolean;
  /** true khi nhiều SKU mà không còn chiều thật nào để phân biệt — không đoán. */
  ambiguous: boolean;
};

/**
 * Giải quyết lựa chọn cho một danh sách biến thể.
 * Không đọc/ghi state, không fetch — thuần túy để kiểm thử biên dễ dàng.
 */
export function resolveSelection(
  variants: VariantLike[],
  color: string,
  size: string,
): Selection {
  const colors = uniqueReal(variants.map((v) => (isSentinel(v.color, v.colorIsSentinel) ? null : v.color)));
  // Một màu thật duy nhất ⇒ không bắt chọn cho có (brief ít thao tác).
  const effColor = color !== "" ? color : colors.length === 1 ? colors[0] : "";
  const sizes = uniqueReal(
    variants
      .filter((v) => effColor === "" || v.color === effColor)
      .map((v) => (isSentinel(v.size, v.sizeIsSentinel) ? null : v.size)),
  );
  const effSize = size !== "" ? size : sizes.length === 1 ? sizes[0] : "";
  const candidates = variants.filter(
    (v) =>
      (colors.length === 0 || (effColor !== "" && v.color === effColor)) &&
      (sizes.length === 0 || (effSize !== "" && v.size === effSize)),
  );
  const selected = candidates.length === 1 ? candidates[0] : undefined;
  const needColor = colors.length > 1 && color === "";
  const needSize = !needColor && sizes.length > 1 && size === "";
  // Mơ hồ thật: hơn một SKU nhưng không còn chiều thật nào để khách phân biệt.
  const ambiguous =
    selected === undefined &&
    candidates.length > 1 &&
    colors.length === 0 &&
    sizes.length === 0;
  return { colors, sizes, effColor, effSize, candidates, selected, needColor, needSize, ambiguous };
}
