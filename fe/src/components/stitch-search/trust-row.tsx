import styles from "./trust-row.module.css";

// Plain-language facts in the source "trust box" layout. No commerce
// promises (returns, shipping, 24/7) and no technical banners — only what
// FaSearch actually does, in ordinary product language.
const ITEMS = [
  {
    title: "Catalog thật đang công bố",
    body: "Mọi kết quả đọc từ catalog đang được công bố, mỗi lần tìm đều ghi rõ nguồn để tra cứu.",
  },
  {
    title: "Phiên đăng nhập của bạn",
    body: "Trình duyệt chỉ giữ mã phiên, mọi thao tác ghi đều xác nhận lại trước khi thực hiện.",
  },
  {
    title: "Ba chế độ tìm kiếm",
    body: "Tìm bằng ảnh, bằng chữ và kết hợp ảnh với chữ — tất cả đều chạy thật trên catalog này.",
  },
  {
    title: "Mọi lần tìm đều tra cứu được",
    body: "Mỗi kết quả kèm mã tra cứu và thời gian xử lý trong mục chi tiết.",
  },
];

export function TrustRow() {
  return (
    <section
      id="cach-hoat-dong"
      className={styles.section}
      aria-label="Cách FaSearch hoạt động"
    >
      <div className={styles.inner}>
        <p className={styles.eyebrow}>Cách hoạt động</p>
        <h2>Tìm đồ thế nào cũng rõ nguồn</h2>
        <ul>
          {ITEMS.map((item) => (
            <li key={item.title}>
              <h3>{item.title}</h3>
              <p>{item.body}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
