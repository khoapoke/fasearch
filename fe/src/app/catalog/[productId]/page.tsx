import { SiteFooter } from "@/components/stitch-search/site-footer";
import { SiteHeader } from "@/components/stitch-search/site-header";
import { CatalogDetail } from "./catalog-detail";
import styles from "./page.module.css";

export const metadata = {
  title: "FaSearch — Chi tiết sản phẩm",
  description: "Ảnh và thông tin thật của một sản phẩm trong catalog pilot.",
};

export default async function CatalogDetailPage({
  params,
}: {
  params: Promise<{ productId: string }>;
}) {
  const { productId } = await params;
  return (
    <div>
      <SiteHeader />
      <main className={styles.page}>
        <CatalogDetail productId={productId} />
      </main>
      <SiteFooter />
    </div>
  );
}
