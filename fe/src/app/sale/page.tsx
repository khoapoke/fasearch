import { Suspense } from "react";
import { CatalogListing, type ListingVariant } from "../nam/catalog-listing";

export const metadata = { title: "Ưu đãi | FaSearch" };

const variant: ListingVariant = { shell: "/sale", title: "Ưu đãi", note: "Sản phẩm hiện chưa có giá khuyến mãi riêng; giá hiển thị là giá bán hiện tại. Ưu đãi dành cho bạn nằm ở mã voucher, nhập khi thanh toán.", links: [{ label: "Xem voucher & ưu đãi", href: "/voucher" }] };

export default function Page() {
  return (
    <Suspense fallback={<p>Đang tải…</p>}>
      <CatalogListing variant={variant} />
    </Suspense>
  );
}
