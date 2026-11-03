import { Suspense } from "react";
import { CatalogListing } from "./catalog-listing";

export const metadata = { title: "Sản phẩm | FaSearch" };

export default function Page() {
  return (
    <Suspense fallback={<p>Đang tải…</p>}>
      <CatalogListing />
    </Suspense>
  );
}
