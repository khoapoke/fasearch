import { SiteHeader } from "@/components/stitch-search/site-header";
import { Hero } from "@/components/stitch-search/hero";
import { ImageSearchWorkbench } from "@/components/image-search-workbench";
import { TrustRow } from "@/components/stitch-search/trust-row";
import { SiteFooter } from "@/components/stitch-search/site-footer";
import styles from "./page.module.css";

export default function Home() {
  return (
    <div className={styles.page}>
      <SiteHeader />
      <main>
        <Hero />
        <ImageSearchWorkbench />
        <TrustRow />
      </main>
      <SiteFooter />
    </div>
  );
}
