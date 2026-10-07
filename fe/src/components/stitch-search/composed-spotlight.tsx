import { ComposedDemo } from "./composed-demo/composed-demo";
import styles from "./composed-spotlight.module.css";

// Approved composed illustration, kept available and labelled as a
// secondary module now that the hero panel is photographic.
export function ComposedSpotlight() {
  return (
    <section className={styles.section} aria-label="Minh họa tìm kết hợp">
      <div className={styles.inner}>
        <p className={styles.eyebrow}>Minh họa</p>
        <h2>Tìm kết hợp ảnh và chữ là như thế nào</h2>
        <p className={styles.lede}>
          Minh họa bằng dữ liệu mẫu, không gọi API. Luồng tìm kết hợp thật nằm
          ở trang tìm kết hợp.
        </p>
        <ComposedDemo />
      </div>
    </section>
  );
}
