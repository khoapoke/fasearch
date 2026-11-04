import { Suspense } from "react";
import { CatalogListing, type ListingVariant } from "../nam/catalog-listing";

export const metadata = { title: "Hàng mới về | FaSearch" };

const variant: ListingVariant = { shell: "/hang-moi", title: "Hàng mới về", note: "Sắp theo thứ tự thêm vào cửa hàng gần nhất (mã sản phẩm mới nhất trước). Cửa hàng chưa có ngày về chính thức." };

export default function Page() {
  return (
    <Suspense fallback={<p>Đang tải…</p>}>
      <CatalogListing variant={variant} />
    </Suspense>
  );
}
