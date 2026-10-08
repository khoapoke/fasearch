import { Suspense } from "react";
import { CatalogDraftForm } from "@/components/catalog-draft-form";

export default async function CatalogDraftPage({
  params,
}: {
  params: Promise<{ productId: string }>;
}) {
  const { productId } = await params;
  return (
    <Suspense fallback={<main><p role="status">Đang tải…</p></main>}>
      <CatalogDraftForm productId={productId} />
    </Suspense>
  );
}
