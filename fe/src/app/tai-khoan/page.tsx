import { AccountCenterShell } from "@/components/storefront/account-center-shell";
import { HubBody } from "@/components/customer-auth/account-panel";

export const metadata = {
  title: "Tài khoản | FaSearch",
  description: "Thông tin tài khoản FaSearch.",
};

export default function AccountPage() {
  return (
    <AccountCenterShell active="/tai-khoan" title="Tài khoản của tôi">
      <HubBody />
    </AccountCenterShell>
  );
}
