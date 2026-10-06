import { SiteFooter } from "@/components/stitch-search/site-footer";
import { SiteHeader } from "@/components/stitch-search/site-header";
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
        <p className={styles.kicker}>Thư viện của tôi</p>
        <h1>Sản phẩm đã lưu.</h1>
        <p className={styles.lede}>
          Dấu trang của chính bạn trên catalog đang công bố — không giá, không
          giỏ hàng, không điểm thưởng.
        </p>
        <SavedList />
      </main>
      <SiteFooter />
    </div>
  );
}
