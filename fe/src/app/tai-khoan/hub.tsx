import Link from "next/link";
import { AccountShell } from "@/components/account/account-shell";
import styles from "@/components/account/account.module.css";

const ACTIONS = [
  {
    href: "/tai-khoan/thong-tin",
    title: "Thông tin cá nhân",
    body: "Xem và sửa họ tên, ngày sinh, địa chỉ, email của bạn.",
    cta: "Sửa thông tin",
  },
  {
    href: "/tai-khoan/bao-mat",
    title: "Bảo mật",
    body: "Đổi mật khẩu bằng mật khẩu hiện tại. Mọi phiên khác hết hiệu lực.",
    cta: "Đổi mật khẩu",
  },
];

export function AccountHub() {
  return (
    <>
      {ACTIONS.map((action) => (
        <section className={styles.card} key={action.href} aria-label={action.title}>
          <p className={styles.greeting}>{action.title}</p>
          <p className={styles.muted} style={{ marginTop: 6 }}>
            {action.body}
          </p>
          <div className={styles.actions} style={{ marginTop: 12 }}>
            <Link className={styles.secondary} href={action.href}>
              {action.cta}
            </Link>
          </div>
        </section>
      ))}
    </>
  );
}

export function AccountHubShell() {
  return (
    <AccountShell
      active="hub"
      kicker="Tài khoản của tôi"
      title="Trung tâm tài khoản"
      lede="Mọi thứ thuộc về tài khoản của bạn — thông tin cá nhân và bảo mật."
      crumb="Tổng quan"
    >
      <AccountHub />
    </AccountShell>
  );
}
