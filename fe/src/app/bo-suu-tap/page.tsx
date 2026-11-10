import { Suspense } from "react";
import { CatalogListing, type ListingVariant } from "../nam/catalog-listing";

export const metadata = { title: "Bộ sưu tập | FaSearch" };

const variant: ListingVariant = { shell: "/bo-suu-tap", title: "Bộ sưu tập theo thương hiệu", note: "Sản phẩm được nhóm theo thương hiệu thật trong cửa hàng. Chọn một thương hiệu để xem bộ sưu tập của hãng.", brandLinks: true };

export default function Page() {
  return (
    <Suspense fallback={<p>Đang tải…</p>}>
      <CatalogListing variant={variant} />
    </Suspense>
  );
}
