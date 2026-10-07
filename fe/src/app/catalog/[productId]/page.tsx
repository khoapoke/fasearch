import Link from "next/link";
import { SiteFooter } from "@/components/stitch-search/site-footer";
import { SiteHeader } from "@/components/stitch-search/site-header";
import { CatalogDetail } from "./catalog-detail";
import styles from "./page.module.css";

export const metadata = {
  title: "FaSearch — Chi tiết sản phẩm",
  description: "Ảnh và thông tin thật của một sản phẩm trong catalog.",
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
        <nav className={styles.crumbs} aria-label="Đường dẫn">
          <Link href="/">Trang chủ</Link>
          <span aria-hidden="true">›</span>
          <Link href="/catalog">Catalog</Link>
          <span aria-hidden="true">›</span>
          <span aria-current="page">{productId}</span>
        </nav>
        <CatalogDetail productId={productId} />
      </main>
      <SiteFooter />
    </div>
  );
}
