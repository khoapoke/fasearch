import Link from "next/link";
import { AccountShell } from "@/components/account/account-shell";
import styles from "@/components/account/account.module.css";

const ACTIONS = [
  {
    href: "/tai-khoan/thong-tin",
    title: "Thông tin cá nhân",
    body: "Tên đăng nhập và email chỉ đọc. Đổi tên hiển thị của bạn tại đây.",
    cta: "Sửa tên hiển thị",
  },
  {
    href: "/tai-khoan/bao-mat",
    title: "Bảo mật",
    body: "Đổi mật khẩu bằng mật khẩu hiện tại. Mọi phiên khác hết hiệu lực.",
    cta: "Đổi mật khẩu",
  },
  {
    href: "/tai-khoan/san-pham-da-luu",
    title: "Sản phẩm đã lưu",
    body: "Xem lại và bỏ lưu các sản phẩm bạn quan tâm.",
    cta: "Xem sản phẩm đã lưu",
  },
  {
    href: "/tai-khoan/lich-su-tim-kiem",
    title: "Lịch sử tìm kiếm",
    body: "Xem, tìm lại và xóa các lần tìm kiếm đã ghi.",
    cta: "Xem lịch sử tìm kiếm",
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
      lede="Mọi thứ thuộc về tài khoản của bạn — thông tin, bảo mật, sản phẩm đã lưu và lịch sử tìm kiếm."
      crumb="Tổng quan"
    >
      <AccountHub />
    </AccountShell>
  );
}
