import Link from "next/link";
import { SiteFooter } from "@/components/stitch-search/site-footer";
import { SiteHeader } from "@/components/stitch-search/site-header";
import { CatalogBrowser } from "./catalog-browser";
import styles from "./page.module.css";

export const metadata = {
  title: "FaSearch — Danh sách sản phẩm",
  description: "Duyệt 600 sản phẩm trong catalog theo danh mục và trang.",
};

export default function CatalogPage() {
  return (
    <div>
      <SiteHeader />
      <main className={styles.page}>
        <nav className={styles.crumbs} aria-label="Đường dẫn">
          <Link href="/">Trang chủ</Link>
          <span aria-hidden="true">›</span>
          <span aria-current="page">Catalog</span>
        </nav>
        <p className={styles.kicker}>Catalog</p>
        <h1>Danh sách sản phẩm</h1>
        <p className={styles.lede}>
          600 sản phẩm đang được công bố, lọc theo danh mục và lật trang. Chọn
          một sản phẩm để xem chi tiết và tìm kết hợp.
        </p>
        <CatalogBrowser />
      </main>
      <SiteFooter />
    </div>
  );
}
