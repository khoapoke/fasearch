import { StorefrontShell } from "@/components/storefront/storefront-shell";
import { ResetPasswordPanel } from "@/components/customer-auth/reset-password-panel";

export const metadata = {
  title: "Đặt lại mật khẩu | FaSearch",
  description: "Tạo mật khẩu mới cho tài khoản FaSearch.",
};

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const params = await searchParams;
  const token = typeof params.token === "string" ? params.token : "";
  return (
    <StorefrontShell active="/dat-lai-mat-khau" themed palette="customer" header="customer-focused" footer="none">
      <ResetPasswordPanel token={token} />
    </StorefrontShell>
  );
}
