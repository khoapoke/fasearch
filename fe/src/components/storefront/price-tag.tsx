import "./price-tag.css";

/**
 * Giá hiển thị dạng "1.450.000đ": số đậm màu brand, đơn vị "đ" viết thường liền sau.
 * size="hero" (trang chi tiết) thêm khung góc ngoặc như logo/chip "Tất cả".
 * Cỡ chữ kế thừa từ phần tử cha (mọi kích thước tính bằng em).
 */
export function PriceTag({ value, size = "card" }: { value: number; size?: "card" | "hero" }) {
  if (!Number.isFinite(value)) return <span className="pxPrice">—</span>;
  const formatted = value.toLocaleString("vi-VN");
  return (
    <span className={size === "hero" ? "pxPrice pxPrice--hero" : "pxPrice"} aria-label={`${formatted} đồng`}>
      <span className="pxPrice-num" aria-hidden="true">{formatted}</span>
      <span className="pxPrice-cur" aria-hidden="true">đ</span>
    </span>
  );
}
