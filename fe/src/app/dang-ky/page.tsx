import Link from "next/link";
import { AuthShell } from "@/components/account/auth-shell";
import styles from "@/components/account/account.module.css";

export const metadata = {
  title: "FaSearch — Tạo tài khoản",
  description: "Đăng ký tài khoản FaSearch hiện chưa mở trong giai đoạn này.",
};

// Public self-registration is out of scope for this slice (DOCX FR02 assigns
// account creation to administrators). This route stays as an honest deferred
// notice instead of a dead-end form.
export default function RegisterPage() {
  return (
    <AuthShell>
      <div className={styles.authCard}>
        <h1>Tạo tài khoản</h1>
        <section className={styles.card} aria-label="Chưa hỗ trợ đăng ký">
            <p className={styles.alert} role="status">
              Chưa mở đăng ký công khai trong giai đoạn này. Tài khoản do quản trị
              viên tạo.
            </p>
            <p className={styles.muted}>
              Nếu bạn đã có tài khoản, hãy{" "}
              <Link href="/dang-nhap">đăng nhập</Link>.
            </p>
          </section>
      </div>
    </AuthShell>
  );
}
