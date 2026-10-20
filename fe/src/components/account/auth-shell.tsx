"use client";

import Link from "next/link";
import styles from "./account.module.css";

// Focused auth surface (Wave2): quiet brand + home wayfinding, centered
// narrow column. No storefront nav/newsletter/footer competing with the form.
// Security behavior lives in the form; this shell is layout only.
export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className={styles.authWrap}>
      <div className={styles.authBar}>
        <Link className={styles.authBrand} href="/" aria-label="FashionSearch AI — về trang chủ">
          <span className={styles.authBrandMark} aria-hidden="true">FS</span>
          FashionSearch AI
        </Link>
        <Link className={styles.authHome} href="/">Về trang chủ</Link>
      </div>
      <main className={styles.authMain}>{children}</main>
    </div>
  );
}
