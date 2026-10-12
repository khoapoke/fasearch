import Link from "next/link";
import { SiteFooter } from "@/components/stitch-search/site-footer";
import { SiteHeader } from "@/components/stitch-search/site-header";
import styles from "@/components/account/account.module.css";

export const metadata = {
  title: "FaSearch — Tài khoản",
  description: "Đăng nhập và quản lý hồ sơ khách hàng FaSearch.",
};

export default function Home() {
  return (
    <div>
      <SiteHeader />
      <main className={styles.layout} id="top">
        <p className={styles.kicker}>FaSearch</p>
        <h1>Tài khoản của bạn</h1>
        <p className={styles.lede}>
          Đăng nhập để xem và sửa hồ sơ khách hàng, đổi mật khẩu và quản lý phiên
          đăng nhập của bạn.
        </p>
        <div className={styles.grid} style={{ gridTemplateColumns: "1fr" }}>
          <section className={styles.card} aria-label="Bắt đầu">
            <div className={styles.actions}>
              <Link className={styles.primary} href="/dang-nhap">
                Đăng nhập
              </Link>
              <Link className={styles.secondary} href="/tai-khoan" id="tai-khoan">
                Trung tâm tài khoản
              </Link>
            </div>
          </section>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
