import { SiteFooter } from "@/components/stitch-search/site-footer";
import { SiteHeader } from "@/components/stitch-search/site-header";
import styles from "@/components/account/account.module.css";
import { RegisterForm } from "./register-form";

export const metadata = {
  title: "FaSearch — Tạo tài khoản",
  description: "Tạo tài khoản FaSearch mới. Không tự đăng nhập sau khi tạo.",
};

export default function RegisterPage() {
  return (
    <div>
      <SiteHeader />
      <main className={styles.layout}>
        <p className={styles.kicker}>Tài khoản</p>
        <h1>Tạo tài khoản</h1>
        <p className={styles.lede}>
          Tạo xong, bạn đăng nhập bằng tên đăng nhập vừa tạo.
        </p>
        <div className={styles.grid} style={{ gridTemplateColumns: "1fr" }}>
          <section className={styles.card} aria-label="Form tạo tài khoản">
            <RegisterForm />
          </section>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
