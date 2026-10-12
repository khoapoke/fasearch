import Link from "next/link";
import styles from "./site-footer.module.css";

// Only real destinations in this slice: home, account routes, login.
// Search/catalog/library/registration routes are out of scope — no links to
// pages that do not exist here.
export function SiteFooter() {
  return (
    <footer className={styles.footer}>
      <div className={styles.inner}>
        <div className={styles.brandCol}>
          <p className={styles.brand}>
            <span className={styles.brandMark} aria-hidden="true">
              FS
            </span>
            FashionSearch <strong>AI</strong>
          </p>
          <p className={styles.note}>
            Tài khoản và hồ sơ khách hàng FaSearch.
          </p>
        </div>
        <nav className={styles.col} aria-label="Tài khoản">
          <p>Tài khoản</p>
          <Link href="/tai-khoan">Tổng quan tài khoản</Link>
          <Link href="/tai-khoan/thong-tin">Thông tin cá nhân</Link>
          <Link href="/tai-khoan/bao-mat">Bảo mật</Link>
          <Link href="/dang-nhap">Đăng nhập</Link>
        </nav>
        <nav className={styles.col} aria-label="Điều hướng">
          <p>Điều hướng</p>
          <Link href="/">Trang chủ</Link>
          <Link href="/#top">Về đầu trang</Link>
        </nav>
      </div>
      <div className={styles.bottom}>
        <p>© 2026 FaSearch.</p>
      </div>
    </footer>
  );
}
