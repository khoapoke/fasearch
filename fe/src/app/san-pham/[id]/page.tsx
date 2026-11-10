import { StorefrontShell } from "@/components/storefront/storefront-shell";
import { DetailView } from "./detail-view";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return { title: `Sản phẩm ${id} | FaSearch` };
}

export default async function DetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <StorefrontShell active="/nam" themed palette="customer" header="customer" footer="none">
      <DetailView id={id} />
    </StorefrontShell>
  );
}
