import Link from "next/link";
import { SiteHeader } from "@/components/stitch-search/site-header";
import { Hero } from "@/components/stitch-search/hero";
import { ImageSearchWorkbench } from "@/components/image-search-workbench";
import { HomeDiscovery } from "@/components/stitch-search/home-discovery";
import { ComposedSpotlight } from "@/components/stitch-search/composed-spotlight";
import { StyleBanners } from "@/components/stitch-search/style-banners";
import { TrustRow } from "@/components/stitch-search/trust-row";
import { SiteFooter } from "@/components/stitch-search/site-footer";
import styles from "./page.module.css";

export default function Home() {
  return (
    <div className={styles.page}>
      <SiteHeader />
      <main>
        <Hero />
        <nav aria-label="Chế độ tìm kiếm" className={styles.modeNav}>
          <Link href="/catalog">Duyệt catalog</Link>
          {" · "}
          <a href="#tim-bang-anh">Tìm bằng ảnh</a>
          {" · "}
          <a href="/search/text">Tìm bằng chữ</a>
          {" · "}
          <a href="/search/composed">Tìm kết hợp</a>
        </nav>
        <ImageSearchWorkbench />
        <HomeDiscovery />
        <StyleBanners />
        <ComposedSpotlight />
        <TrustRow />
      </main>
      <SiteFooter />
    </div>
  );
}
