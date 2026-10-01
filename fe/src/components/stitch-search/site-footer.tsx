import Link from "next/link";
import styles from "./site-footer.module.css";

// Only real destinations: in-page anchors and the existing Draft route.
// No policy/shop/support links — they do not exist in this slice.
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
            Slice đầu tiên của website: tìm sản phẩm thời trang bằng hình ảnh
            trên catalog đang được công bố. Không phải trang thương mại.
          </p>
        </div>
        <nav className={styles.col} aria-label="Luồng tìm kiếm">
          <p>Luồng tìm kiếm</p>
          <Link href="#tim-bang-anh">Tìm bằng ảnh</Link>
          <Link href="#ket-qua">Kết quả</Link>
          <Link href="#cach-hoat-dong">Cách hoạt động</Link>
        </nav>
        <nav className={styles.col} aria-label="Vận hành catalog">
          <p>Vận hành catalog</p>
          <Link href="/catalog/drafts/new">Tạo sản phẩm nháp</Link>
          <Link href="#top">Về đầu trang</Link>
        </nav>
      </div>
      <div className={styles.bottom}>
        <p>© 2026 FaSearch — slice tìm kiếm bằng ảnh.</p>
      </div>
    </footer>
  );
}
