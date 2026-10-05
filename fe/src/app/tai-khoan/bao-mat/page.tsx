import { SiteFooter } from "@/components/stitch-search/site-footer";
import { SiteHeader } from "@/components/stitch-search/site-header";
import styles from "@/components/account/account.module.css";
import { PasswordForm } from "./password-form";

export const metadata = {
  title: "FaSearch — Bảo mật tài khoản",
  description: "Đổi mật khẩu FaSearch. Mọi phiên hết hiệu lực sau khi đổi.",
};

export default function SecurityPage() {
  return (
    <div>
      <SiteHeader />
      <main className={styles.layout}>
        <p className={styles.kicker}>Tài khoản của tôi · Bảo mật</p>
        <h1>Bảo mật.</h1>
        <p className={styles.lede}>
          Đổi mật khẩu cần mật khẩu hiện tại. Không có MFA, OTP hay quên mật khẩu trong slice này.
        </p>
        <div className={styles.grid}>
          <aside className={styles.side} aria-label="Điều hướng tài khoản">
            <nav className={`${styles.card} ${styles.sideNav}`} aria-label="Quản lý tài khoản">
              <a href="/tai-khoan">Tổng quan</a>
              <a href="/tai-khoan/thong-tin">Thông tin cá nhân</a>
              <a href="/tai-khoan/bao-mat" aria-current="page">Bảo mật</a>
            </nav>
          </aside>
          <section className={styles.card} aria-label="Form đổi mật khẩu">
            <PasswordForm />
          </section>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
