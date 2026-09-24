import { CatalogDraftForm } from "@/components/catalog-draft-form";

export default async function CatalogDraftPage({
  params,
}: {
  params: Promise<{ productId: string }>;
}) {
  const { productId } = await params;
  return <CatalogDraftForm productId={productId} />;
}
