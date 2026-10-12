import { SiteFooter } from "@/components/stitch-search/site-footer";
import { SiteHeader } from "@/components/stitch-search/site-header";
import styles from "@/components/account/account.module.css";
import { AccountHubShell } from "./hub";

export const metadata = {
  title: "FaSearch — Tài khoản của tôi",
  description: "Trung tâm quản lý tài khoản FaSearch.",
};

export default function AccountPage() {
  return (
    <div>
      <SiteHeader />
      <main className={styles.layout}>
        <AccountHubShell />
      </main>
      <SiteFooter />
    </div>
  );
}
