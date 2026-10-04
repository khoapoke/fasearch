import { TextSearchWorkbench } from "@/components/text-search/text-search-workbench";
import styles from "./page.module.css";

export const metadata = {
  title: "FaSearch — Tìm kiếm bằng chữ",
  description: "Tìm sản phẩm thời trang bằng mô tả chữ.",
};

export default function TextSearchPage() {
  return (
    <main className={styles.page}>
      <p className={styles.kicker}>Tìm kiếm bằng chữ</p>
      <h1>Mô tả bằng chữ, nhận kết quả thật.</h1>
      <p className={styles.lede}>
        Nhập mô tả sản phẩm, FaSearch đối chiếu với catalog đang được công bố
        và giữ nguyên thứ tự xếp hạng từ mô hình.
      </p>
      <TextSearchWorkbench />
    </main>
  );
}
