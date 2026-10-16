import { StorefrontShell } from "@/components/storefront/storefront-shell";
import { DetailView } from "./detail-view";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return { title: `Sản phẩm ${id} | FashionSearch AI` };
}

export default async function DetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <StorefrontShell active="/nam">
      <DetailView id={id} />
    </StorefrontShell>
  );
}
