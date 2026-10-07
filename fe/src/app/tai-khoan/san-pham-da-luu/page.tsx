import { SiteFooter } from "@/components/stitch-search/site-footer";
import { SiteHeader } from "@/components/stitch-search/site-header";
import { AccountShell } from "@/components/account/account-shell";
import styles from "@/components/account/account.module.css";
import { SavedList } from "./saved-list";

export const metadata = {
  title: "FaSearch — Sản phẩm đã lưu",
  description: "Các sản phẩm bạn đã lưu vào thư viện cá nhân.",
};

export default function SavedProductsPage() {
  return (
    <div>
      <SiteHeader />
      <main className={styles.layout}>
        <AccountShell
          active="saved"
          kicker="Thư viện của tôi"
          title="Sản phẩm đã lưu"
          lede="Những sản phẩm bạn đánh dấu quan tâm trên catalog đang được công bố."
          crumb="Sản phẩm đã lưu"
        >
          <SavedList />
        </AccountShell>
      </main>
      <SiteFooter />
    </div>
  );
}
