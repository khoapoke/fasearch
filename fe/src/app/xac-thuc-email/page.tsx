import { StorefrontShell } from "@/components/storefront/storefront-shell";
import { VerifyEmailPanel } from "@/components/customer-auth/verify-email-panel";

export const metadata = {
  title: "Xác thực email | FaSearch",
  description: "Xác thực địa chỉ email tài khoản FaSearch.",
};

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const params = await searchParams;
  const token = typeof params.token === "string" ? params.token : "";
  return (
    <StorefrontShell active="/xac-thuc-email" themed palette="customer" header="customer-focused" footer="none">
      <VerifyEmailPanel token={token} />
    </StorefrontShell>
  );
}
