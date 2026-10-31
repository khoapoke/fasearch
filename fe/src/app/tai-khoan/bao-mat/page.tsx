import Link from "next/link";
import { AccountCenterShell } from "@/components/storefront/account-center-shell";
import { PasswordForm } from "./password-form";
import { NotifyToggles } from "./notify-toggles";

export const metadata = {
  title: "Cài Đặt Tài Khoản & Bảo Mật | FashionSearch AI",
  description: "Đổi mật khẩu FaSearch. Mọi phiên hết hiệu lực sau khi đổi.",
};

export default function SecurityPage() {
  return (
    <AccountCenterShell active="/tai-khoan/bao-mat" title="Bảo mật tài khoản">
      <section className="sfSideCard" aria-label="Form đổi mật khẩu">
        <PasswordForm />
      </section>
      <section className="sfSideCard" aria-label="Cài đặt thông báo">
        <NotifyToggles />
      </section>
      <section className="sfSideCard" aria-label="Lớp bảo vệ bổ sung">
        <b>Xác thực hai lớp (2FA) &amp; phiên đăng nhập</b>
        <p className="sfIdentitySub" style={{ marginTop: 6 }}>
          Bản xem trước minh họa: máy chủ hiện tại dùng phiên cookie HttpOnly + CSRF,
          chưa có 2FA. <Link href="/tai-khoan">Quay lại trung tâm →</Link>
        </p>
      </section>
    </AccountCenterShell>
  );
}
