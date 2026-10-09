import { Suspense } from "react";
import { CatalogDraftForm } from "@/components/catalog-draft-form";

export default function NewCatalogDraftPage() {
  return (
    <Suspense fallback={<main><p role="status">Đang tải…</p></main>}>
      <CatalogDraftForm />
    </Suspense>
  );
}
