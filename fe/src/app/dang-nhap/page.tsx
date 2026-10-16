import { StorefrontShell } from "@/components/storefront/storefront-shell";
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
    <StorefrontShell active="/tai-khoan">
      <main className={styles.layout}>
        <p className={styles.kicker}>Tài khoản</p>
        <h1>Đăng nhập</h1>
        <p className={styles.lede}>
          Dùng tên đăng nhập và mật khẩu của bạn.
        </p>
        <div className={styles.grid} style={{ gridTemplateColumns: "1fr" }}>
          <section className={styles.card} aria-label="Form đăng nhập">
            <LoginForm next={next} passwordChanged={params.password === "changed"} />
          </section>
        </div>
      </main>
    </StorefrontShell>
  );
}
