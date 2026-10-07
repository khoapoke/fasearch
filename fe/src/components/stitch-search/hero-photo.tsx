import styles from "./hero-photo.module.css";

// Supplied Stitch hero photo (local capture under fe/public/stitch-assets).
// Overlay states one real, checkable fact: the live catalog size.
export function HeroPhotoCard() {
  return (
    <figure className={styles.frame} aria-label="Ảnh người mẫu mặc đồ thể thao tối giản">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        className={styles.photo}
        src="/stitch-assets/hero.jpg"
        alt="Người mẫu mặc áo thun trắng, quần short xám và giày trắng trên nền studio sáng"
      />
      <figcaption className={styles.overlay}>
        <span className={styles.badge}>Catalog thật</span>
        <span className={styles.caption}>Đang được công bố</span>
      </figcaption>
    </figure>
  );
}
