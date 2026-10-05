import { SiteFooter } from "@/components/stitch-search/site-footer";
import { SiteHeader } from "@/components/stitch-search/site-header";
import styles from "@/components/account/account.module.css";
import { AccountHub } from "./hub";

export const metadata = {
  title: "FaSearch — Tài khoản của tôi",
  description: "Trung tâm quản lý tài khoản FaSearch.",
};

export default function AccountPage() {
  return (
    <div>
      <SiteHeader />
      <main className={styles.layout}>
        <p className={styles.kicker}>Tài khoản của tôi</p>
        <h1>Trung tâm tài khoản.</h1>
        <p className={styles.lede}>
          Thông tin thật từ tài khoản của bạn — không có đơn hàng, voucher hay điểm thưởng.
        </p>
        <AccountHub />
      </main>
      <SiteFooter />
    </div>
  );
}
