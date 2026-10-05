import { SiteFooter } from "@/components/stitch-search/site-footer";
import { SiteHeader } from "@/components/stitch-search/site-header";
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
  searchParams: Promise<{ next?: string; registered?: string; password?: string }>;
}) {
  const params = await searchParams;
  const next = safeAccountReturnHref(
    typeof params.next === "string" ? params.next : null,
  );
  return (
    <div>
      <SiteHeader />
      <main className={styles.layout}>
        <p className={styles.kicker}>Tài khoản</p>
        <h1>Đăng nhập.</h1>
        <p className={styles.lede}>
          Dùng tên đăng nhập đã tạo khi đăng ký — FaSearch không dùng email để đăng nhập.
        </p>
        <div className={styles.grid} style={{ gridTemplateColumns: "1fr" }}>
          <section className={styles.card} aria-label="Form đăng nhập">
            <LoginForm
              next={next}
              registered={params.registered === "1"}
              passwordChanged={params.password === "changed"}
            />
          </section>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
