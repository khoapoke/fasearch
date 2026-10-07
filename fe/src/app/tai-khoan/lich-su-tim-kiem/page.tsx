import { Suspense } from "react";
import { SiteFooter } from "@/components/stitch-search/site-footer";
import { SiteHeader } from "@/components/stitch-search/site-header";
import { AccountShell } from "@/components/account/account-shell";
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
        <AccountShell
          active="history"
          kicker="Thư viện của tôi"
          title="Lịch sử tìm kiếm"
          lede="Chỉ những lần tìm bạn đồng ý ghi lại. Ảnh tải lên không hiển thị lại ở đây."
          crumb="Lịch sử tìm kiếm"
        >
          <Suspense fallback={<p>Đang tải lịch sử…</p>}>
            <HistoryList />
          </Suspense>
        </AccountShell>
      </main>
      <SiteFooter />
    </div>
  );
}
