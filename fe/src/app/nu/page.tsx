import { Suspense } from "react";
import { CatalogListing, type ListingVariant } from "../nam/catalog-listing";

export const metadata = { title: "Tất cả sản phẩm | FaSearch" };

const variant: ListingVariant = { shell: "/nu", title: "Tất cả sản phẩm", note: "Cửa hàng chưa gắn nhãn giới tính cho sản phẩm, nên trang này hiển thị toàn bộ danh mục. Gợi ý nhanh theo danh mục thật:", links: [{ label: "Váy", href: "/nu?categoryId=92" }, { label: "Áo kiểu", href: "/nu?categoryId=12" }] };

export default function Page() {
  return (
    <Suspense fallback={<p>Đang tải…</p>}>
      <CatalogListing variant={variant} />
    </Suspense>
  );
}
