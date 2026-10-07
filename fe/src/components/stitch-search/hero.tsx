import Link from "next/link";
import { ComposedDemo } from "./composed-demo/composed-demo";
import styles from "./hero.module.css";

// Stitch home hero, two-column desktop composition. Copy is faithful to this
// slice (no 98%/0.45s demo claims, no commerce promises): CTAs scroll into
// the working image flow. The right panel is a labelled composed-search
// illustration (local fixtures, zero backend requests); live composed API
// remains a separate ticket.

const CATEGORIES = [
  { code: "TOP", label: "Áo", note: "Tops", href: "/catalog?category=TOP" },
  { code: "BOTTOM", label: "Quần / váy rời", note: "Bottoms", href: "/catalog?category=BOTTOM" },
  { code: "ONE_PIECE", label: "Trang phục liền", note: "One-piece", href: "/catalog?category=ONE_PIECE" },
];

export function Hero() {
  return (
    <section id="top" className={styles.hero} aria-label="Giới thiệu tìm kiếm bằng ảnh">
      <div className={styles.inner}>
        <div className={styles.copy}>
          <p className={styles.eyebrow}>Tìm kiếm thời trang bằng hình ảnh</p>
          <h1>
            Thấy outfit đẹp?
            <br />
            Tìm đồ tương tự <span>bằng một tấm ảnh.</span>
          </h1>
          <p className={styles.sub}>
            Tải ảnh trang phục, FaSearch đối chiếu với catalog đang được công
            bố và giữ nguyên thứ tự xếp hạng từ mô hình. Không cần biết tên
            sản phẩm hay thuật ngữ thời trang.
          </p>
          <div className={styles.ctas}>
            <a className={styles.primary} href="#tim-bang-anh">
              Tải ảnh tìm ngay
            </a>
            <a className={styles.secondary} href="#cach-hoat-dong">
              Xem cách hoạt động
            </a>
          </div>
          <p className={styles.meta}>
            JPEG · PNG · WebP · tối đa 10 MiB · 8 kết quả mỗi lần tìm
          </p>
        </div>

        <div className={styles.demo}>
          <ComposedDemo />
        </div>
      </div>

      <div className={styles.categories}>
        <p className={styles.categoriesTitle}>
          Danh mục trong catalog <span aria-hidden="true">·</span>
        </p>
        <ul>
          {CATEGORIES.map((category) => (
            <li key={category.code}>
              <Link className={styles.chip} href={category.href}>
                {category.label}
              </Link>
              <span className={styles.chipNote}>{category.note}</span>
            </li>
          ))}
        </ul>
        <p className={styles.categoriesNote}>
          Ba nhóm trong catalog đang được công bố — chọn một nhóm để lọc ngay.
        </p>
      </div>
    </section>
  );
}
