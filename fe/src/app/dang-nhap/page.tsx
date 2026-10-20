import { AuthShell } from "@/components/account/auth-shell";
import { safeAccountReturnHref } from "@/lib/account-contract";
import styles from "@/components/account/account.module.css";
import { LoginForm } from "./login-form";

export const metadata = {
  title: "FaSearch — Đăng nhập",
  description: "Đăng nhập FaSearch bằng tên đăng nhập.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; password?: string }>;
}) {
  const params = await searchParams;
  const next = safeAccountReturnHref(
    typeof params.next === "string" ? params.next : null,
  );
  return (
    <AuthShell>
      <div className={styles.authCard}>
        <h1>Đăng nhập</h1>
        <p className={styles.authLede}>Dùng tên đăng nhập và mật khẩu của bạn.</p>
        <section className={styles.card} aria-label="Form đăng nhập">
          <LoginForm next={next} passwordChanged={params.password === "changed"} />
        </section>
      </div>
    </AuthShell>
  );
}
