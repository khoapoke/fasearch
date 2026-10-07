import { Suspense } from "react";
import { ComposedSearchWorkbench } from "@/components/composed-search/composed-search-workbench";
import { SiteFooter } from "@/components/stitch-search/site-footer";
import { SiteHeader } from "@/components/stitch-search/site-header";
import styles from "./page.module.css";

export const metadata = {
  title: "FaSearch — Tìm kiếm kết hợp ảnh và chữ",
  description: "Tìm sản phẩm thời trang bằng ảnh tham chiếu và mô tả thay đổi.",
};

export default function ComposedSearchPage() {
  return (
    <div>
      <SiteHeader />
      <main className={styles.page}>
        <p className={styles.kicker}>Tìm kiếm kết hợp</p>
        <h1>Tìm bằng ảnh và mô tả thay đổi.</h1>
        <p className={styles.lede}>
          Chọn một ảnh tham chiếu, mô tả điểm muốn thay đổi, FaSearch đối chiếu
          cả hai với catalog đang được công bố và giữ nguyên thứ tự xếp hạng từ
          mô hình.
        </p>
        <Suspense fallback={<p>Đang tải công cụ tìm kiếm…</p>}>
          <ComposedSearchWorkbench />
        </Suspense>
      </main>
      <SiteFooter />
    </div>
  );
}
