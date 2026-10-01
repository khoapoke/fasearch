import styles from "./hero.module.css";

// Stitch home hero, two-column desktop composition. Copy is faithful to this
// slice (no 98%/0.45s demo claims, no commerce promises): CTAs scroll into
// the working image flow. The right panel is decorative CSS (aria-hidden);
// the overlay card states the real contract: k = 8, one shared
// model/index/catalog version per response.

const CATEGORIES = [
  { code: "TOP", label: "Áo", note: "Tops" },
  { code: "BOTTOM", label: "Quần / váy rời", note: "Bottoms" },
  { code: "ONE_PIECE", label: "Trang phục liền", note: "One-piece" },
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

        <div className={styles.visual} aria-hidden="true">
          <div className={styles.photo}>
            <span className={styles.photoGlyph}>FS</span>
          </div>
          <div className={styles.overlayCard}>
            <p className={styles.overlayTitle}>Ảnh truy vấn → 8 kết quả xếp hạng</p>
            <p className={styles.overlaySub}>
              Cùng model, index và catalog version cho mọi kết quả
            </p>
          </div>
        </div>
      </div>

      <div className={styles.categories}>
        <p className={styles.categoriesTitle}>
          Danh mục trong catalog <span aria-hidden="true">·</span>
        </p>
        <ul>
          {CATEGORIES.map((category) => (
            <li key={category.code}>
              <span className={styles.chip}>{category.label}</span>
              <span className={styles.chipNote}>{category.note}</span>
            </li>
          ))}
        </ul>
        <p className={styles.categoriesNote}>
          Lọc và duyệt theo danh mục thuộc ticket website sau; slice này tìm
          trên toàn catalog đang công bố.
        </p>
      </div>
    </section>
  );
}
