import Link from "next/link";
import styles from "./site-footer.module.css";

// Only real destinations: search flows, account/library routes, catalog
// drafting and in-page anchors. No policy/shop/support/commerce links —
// they do not exist in this slice.
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
            Tìm sản phẩm thời trang tương đồng từ một ảnh truy vấn, trên
            catalog đang được công bố.
          </p>
        </div>
        <nav className={styles.col} aria-label="Luồng tìm kiếm">
          <p>Luồng tìm kiếm</p>
          <Link href="/#tim-bang-anh">Tìm bằng ảnh</Link>
          <Link href="/search/text">Tìm bằng chữ</Link>
          <Link href="/search/composed">Tìm kết hợp</Link>
          <Link href="/#cach-hoat-dong">Cách hoạt động</Link>
        </nav>
        <nav className={styles.col} aria-label="Tài khoản và thư viện">
          <p>Tài khoản và thư viện</p>
          <Link href="/tai-khoan">Tổng quan tài khoản</Link>
          <Link href="/tai-khoan/san-pham-da-luu">Sản phẩm đã lưu</Link>
          <Link href="/tai-khoan/lich-su-tim-kiem">Lịch sử tìm kiếm</Link>
          <Link href="/dang-nhap">Đăng nhập</Link>
          <Link href="/dang-ky">Tạo tài khoản</Link>
        </nav>
        <nav className={styles.col} aria-label="Vận hành catalog">
          <p>Vận hành catalog</p>
          <Link href="/catalog">Duyệt catalog</Link>
          <Link href="/catalog/drafts/new">Tạo sản phẩm nháp</Link>
          <Link href="/#top">Về đầu trang</Link>
        </nav>
      </div>
      <div className={styles.bottom}>
        <p>© 2026 FaSearch.</p>
      </div>
    </footer>
  );
}
