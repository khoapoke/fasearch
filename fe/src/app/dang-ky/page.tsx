import { StorefrontShell } from "@/components/storefront/storefront-shell";
import { RegisterPanel } from "@/components/customer-auth/register-panel";

export const metadata = {
  title: "Tạo tài khoản | FaSearch",
  description: "Tạo tài khoản khách hàng FaSearch.",
};

export default function RegisterPage() {
  return (
    <StorefrontShell active="/dang-ky" themed palette="customer" header="customer-focused" footer="none">
      <RegisterPanel />
    </StorefrontShell>
  );
}
