import { StorefrontShell } from "@/components/storefront/storefront-shell";
import { ForgotPasswordPanel } from "@/components/customer-auth/forgot-password-panel";

export const metadata = {
  title: "Quên mật khẩu | FaSearch",
  description: "Nhận liên kết đặt lại mật khẩu FaSearch qua email.",
};

export default function ForgotPasswordPage() {
  return (
    <StorefrontShell active="/quen-mat-khau" themed palette="customer" header="customer-focused" footer="none">
      <ForgotPasswordPanel />
    </StorefrontShell>
  );
}
