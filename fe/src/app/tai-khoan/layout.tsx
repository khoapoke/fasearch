// Persistent account frame: sidebar/header/identity survive client navigation
// between /tai-khoan child routes (no full reload, no per-route identity fetch).
// Page titles stay on each child page's own metadata (no template here, so no
// doubled "| FaSearch" suffix).
import { AccountCenterFrame } from "@/components/storefront/account-center-frame";

export default function AccountLayout({ children }: { children: React.ReactNode }) {
  return <AccountCenterFrame>{children}</AccountCenterFrame>;
}
