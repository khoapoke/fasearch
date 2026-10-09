import { Suspense } from "react";
import { CatalogDraftList } from "@/components/catalog-draft-list";

export default function CatalogDraftListPage() {
  return (
    <Suspense fallback={<main><h1>Sản phẩm nháp</h1><p role="status">Đang tải…</p></main>}>
      <CatalogDraftList />
    </Suspense>
  );
}
