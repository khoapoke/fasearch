import styles from "./trust-row.module.css";

// Faithful project facts in the source "trust box" layout. No commerce
// promises (returns, shipping, 24/7) — only what this slice actually does.
const ITEMS = [
  {
    title: "Catalog được version hóa",
    body: "Kết quả đọc từ publication đã phê duyệt, mỗi response ghi rõ snapshot, model và index.",
  },
  {
    title: "Phiên đăng nhập server-side",
    body: "Browser chỉ giữ session ID HttpOnly; thao tác ghi dùng CSRF token trong bộ nhớ trang.",
  },
  {
    title: "Tìm bằng ảnh trước",
    body: "Slice này kiểm chứng image mode; text và composed theo roadmap website, không gắn nút giả.",
  },
  {
    title: "Truy vết từng request",
    body: "Mỗi lần tìm trả trace ID và độ trễ AI/toàn tuyến trong mục chẩn đoán.",
  },
];

export function TrustRow() {
  return (
    <section
      id="cach-hoat-dong"
      className={styles.section}
      aria-label="Cách hoạt động của slice"
    >
      <div className={styles.inner}>
        <p className={styles.eyebrow}>Cách hoạt động</p>
        <h2>Đúng phạm vi slice, truy vết được</h2>
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
