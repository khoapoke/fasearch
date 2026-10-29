import { StorefrontShell } from "@/components/storefront/storefront-shell";
import { AccountPanel } from "@/components/customer-auth/account-panel";

export const metadata = {
  title: "Tài khoản | FaSearch",
  description: "Thông tin tài khoản FaSearch.",
};

export default function AccountPage() {
  return (
    <StorefrontShell active="/tai-khoan" themed palette="customer" header="customer" footer="none">
      <AccountPanel />
    </StorefrontShell>
  );
}
