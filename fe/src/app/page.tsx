import { ImageSearchWorkbench } from "@/components/image-search-workbench";
import styles from "./page.module.css";

export default function Home() {
  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <a className={styles.brand} href="#top" aria-label="FaSearch home">
          <span className={styles.brandMark} aria-hidden="true">
            F
          </span>
          <span>FaSearch</span>
        </a>
        <div className={styles.status}>
          <span className={styles.statusDot} aria-hidden="true" />
          Image search slice
        </div>
      </header>

      <section id="top" className={styles.intro}>
        <div>
          <h1>Biến một tấm ảnh thành đường dẫn vào catalog.</h1>
          <p>
            Tải ảnh trang phục, FaSearch sẽ đối chiếu với catalog đang được
            công bố và giữ nguyên thứ tự xếp hạng từ mô hình.
          </p>
        </div>
        <p className={styles.scopeNote}>
          Slice hiện tại kiểm chứng luồng tìm kiếm bằng ảnh. Kết quả dùng
          publication đã version hóa, chưa phải đánh giá chất lượng cuối.
        </p>
      </section>

      <ImageSearchWorkbench />
    </main>
  );
}
