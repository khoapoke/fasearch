import Link from "next/link";
import styles from "./style-banners.module.css";

// Editorial banner cards from supplied Stitch photos (local capture).
// Presentation only: real catalog/search actions, no collection feature,
// inventory, pricing or retail claims. Photos credited in-page.
const BANNERS = [
  {
    photo: "/stitch-assets/banner-active.jpg",
    alt: "Vận động viên khởi động ngoài trời trong trang phục thể thao",
    title: "Vận động",
    body: "Đồ thể thao nhẹ, co giãn trong catalog.",
    cta: { href: "/catalog", label: "Duyệt catalog" },
  },
  {
    photo: "/stitch-assets/banner-street.jpg",
    alt: "Người đàn ông mặc sơ mi và quần dài dạo phố",
    title: "Thường ngày",
    body: "Sơ mi, quần dài cho ngày thường trong catalog.",
    cta: { href: "/catalog", label: "Duyệt catalog" },
  },
];

export function StyleBanners() {
  return (
    <section className={styles.section} aria-label="Gợi ý phong cách">
      <div className={styles.inner}>
        <h2>Gợi ý phong cách</h2>
        <p className={styles.lede}>
          Ảnh minh họa từ Stitch. Nhấn để duyệt nhóm sản phẩm thật tương ứng.
        </p>
        <div className={styles.grid}>
          {BANNERS.map((banner) => (
            <article key={banner.title} className={styles.card}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className={styles.photo} src={banner.photo} alt={banner.alt} loading="lazy" />
              <div className={styles.body}>
                <h3>{banner.title}</h3>
                <p>{banner.body}</p>
                <div className={styles.actions}>
                  <Link className={styles.primary} href={banner.cta.href}>
                    {banner.cta.label}
                  </Link>
                  <Link className={styles.secondary} href="/#tim-bang-anh">
                    Tìm bằng ảnh
                  </Link>
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
