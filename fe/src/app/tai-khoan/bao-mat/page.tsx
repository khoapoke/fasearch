import { PasswordForm } from "./password-form";
import { SecurityEmailStatus } from "./verification-status";
import ac from "@/components/account/account-cards.module.css";

export const metadata = {
  title: "Cài Đặt Tài Khoản & Bảo Mật | FaSearch",
  description: "Đổi mật khẩu tài khoản FaSearch.",
};

export default function SecurityPage() {
  return (
    <div className={ac.page}>
      <section className={ac.card} aria-labelledby="sec-email">
        <div className={ac.head}>
          <p className={ac.eyebrow}>01 · Email</p>
          <h2 id="sec-email" className={ac.title}>Email xác thực</h2>
        </div>
        <SecurityEmailStatus />
      </section>

      <section className={ac.card} aria-labelledby="sec-password">
        <div className={ac.head}>
          <p className={ac.eyebrow}>02 · Mật khẩu</p>
          <h2 id="sec-password" className={ac.title}>Đổi mật khẩu</h2>
          <p className={ac.lead}>Chọn một mật khẩu dài, dễ nhớ với bạn và không dùng lại ở trang khác.</p>
        </div>
        <PasswordForm />
      </section>

      <section className={`${ac.card} ${ac.soon}`} aria-labelledby="sec-soon">
        <div className={ac.head}>
          <p className={ac.eyebrow}>03 · Sắp có</p>
          <h2 id="sec-soon" className={ac.title}>Bảo mật nâng cao</h2>
        </div>
        <ul className={ac.list}>
          <li><span>Xác thực hai lớp</span><span className={ac.chip}>Sắp có</span></li>
          <li><span>Quản lý phiên đăng nhập trên các thiết bị</span><span className={ac.chip}>Sắp có</span></li>
        </ul>
      </section>
    </div>
  );
}
