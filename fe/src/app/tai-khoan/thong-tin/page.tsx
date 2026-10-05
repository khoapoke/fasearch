import { SiteFooter } from "@/components/stitch-search/site-footer";
import { SiteHeader } from "@/components/stitch-search/site-header";
import styles from "@/components/account/account.module.css";
import { ProfileEditor } from "./profile-editor";

export const metadata = {
  title: "FaSearch — Thông tin cá nhân",
  description: "Xem và đổi tên hiển thị FaSearch.",
};

export default function ProfilePage() {
  return (
    <div>
      <SiteHeader />
      <main className={styles.layout}>
        <p className={styles.kicker}>Tài khoản của tôi · Thông tin cá nhân</p>
        <h1>Thông tin cá nhân.</h1>
        <p className={styles.lede}>
          Tên đăng nhập và email chỉ đọc. Chỉ tên hiển thị được sửa.
        </p>
        <div className={styles.grid}>
          <aside className={styles.side} aria-label="Điều hướng tài khoản">
            <nav className={`${styles.card} ${styles.sideNav}`} aria-label="Quản lý tài khoản">
              <a href="/tai-khoan">Tổng quan</a>
              <a href="/tai-khoan/thong-tin" aria-current="page">Thông tin cá nhân</a>
              <a href="/tai-khoan/bao-mat">Bảo mật</a>
            </nav>
          </aside>
          <section className={styles.card} aria-label="Form thông tin cá nhân">
            <ProfileEditor />
          </section>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
