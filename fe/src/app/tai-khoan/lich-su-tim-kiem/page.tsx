import { Suspense } from "react";
import { SiteFooter } from "@/components/stitch-search/site-footer";
import { SiteHeader } from "@/components/stitch-search/site-header";
import styles from "@/components/account/account.module.css";
import { HistoryList } from "./history-list";

export const metadata = {
  title: "FaSearch — Lịch sử tìm kiếm",
  description: "Các lần tìm kiếm bạn đã chọn ghi lại vào thư viện cá nhân.",
};

export default function SearchHistoryPage() {
  return (
    <div>
      <SiteHeader />
      <main className={styles.layout}>
        <p className={styles.kicker}>Thư viện của tôi</p>
        <h1>Lịch sử tìm kiếm.</h1>
        <p className={styles.lede}>
          Chỉ những lần tìm bạn đồng ý ghi lại — không ảnh tải lên, không dùng
          cho huấn luyện hay cá nhân hóa.
        </p>
        <Suspense fallback={<p>Đang tải lịch sử…</p>}>
          <HistoryList />
        </Suspense>
      </main>
      <SiteFooter />
    </div>
  );
}
