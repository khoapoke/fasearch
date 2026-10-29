import { StorefrontShell } from "@/components/storefront/storefront-shell";
import { safeAccountReturnHref } from "@/lib/account-contract";
import { LoginPanel } from "@/components/customer-auth/login-panel";

export const metadata = {
  title: "Đăng nhập | FaSearch",
  description: "Đăng nhập tài khoản FaSearch.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const params = await searchParams;
  const next = safeAccountReturnHref(typeof params.next === "string" ? params.next : null);
  return (
    <StorefrontShell active="/dang-nhap" themed palette="customer" header="customer-focused" footer="none">
      <LoginPanel next={next} />
    </StorefrontShell>
  );
}
