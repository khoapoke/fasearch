import Link from "next/link";
import { AccountCenterShell } from "@/components/storefront/account-center-shell";
import { PasswordForm } from "./password-form";
import { SecurityEmailStatus } from "./verification-status";

export const metadata = {
  title: "Cài Đặt Tài Khoản & Bảo Mật | FaSearch",
  description: "Đổi mật khẩu tài khoản FaSearch.",
};

export default function SecurityPage() {
  return (
    <AccountCenterShell active="/tai-khoan/bao-mat" title="Bảo mật tài khoản">
      <section aria-label="Xác thực email">
        <h2>Email xác thực</h2>
        <SecurityEmailStatus />
      </section>
      <section aria-label="Đổi mật khẩu">
        <PasswordForm />
      </section>
      <section className="acct-note" aria-label="Tính năng chưa hỗ trợ">
        <h2>Chưa hỗ trợ</h2>
        <p>
          Xác thực hai lớp và quản lý phiên đăng nhập chưa có trong hệ thống hiện tại.
          Trang này không mô phỏng các tính năng đó.
        </p>
        <p>
          Sau khi đổi mật khẩu thành công, bạn được đưa về trang đăng nhập để đăng nhập lại bằng mật khẩu mới.
        </p>
        <p><Link href="/tai-khoan">Quay lại trung tâm tài khoản →</Link></p>
      </section>
    </AccountCenterShell>
  );
}
