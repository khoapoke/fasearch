"use client";

import Link from "next/link";
import { AuthPanel } from "@/components/auth-panel";
import styles from "./site-header.module.css";

// Slice header: only real routes (home anchors + account). Search/catalog
// modes live in another slice — no links to pages that do not exist here.

const NAV = [
  { href: "/#tai-khoan", label: "Tài khoản" },
  { href: "/tai-khoan/thong-tin", label: "Thông tin" },
  { href: "/tai-khoan/bao-mat", label: "Bảo mật" },
];

export function SiteHeader() {
  return (
    <>
      <p className={styles.promo}>
        Tài khoản và hồ sơ khách hàng FaSearch
      </p>
      <header className={styles.header}>
        <div className={styles.bar}>
          <Link className={styles.brand} href="/#top" aria-label="FaSearch — về đầu trang">
            <span className={styles.brandMark} aria-hidden="true">
              FS
            </span>
            <span>
              FashionSearch <strong>AI</strong>
            </span>
          </Link>
          <nav className={styles.nav} aria-label="Điều hướng chính">
            {NAV.map((item) => (
              <Link key={item.href} href={item.href}>
                {item.label}
              </Link>
            ))}
          </nav>
          <div className={styles.actions}>
            <Link
              className={styles.cameraButton}
              href="/tai-khoan"
              aria-label="Mở trung tâm tài khoản"
              title="Tài khoản của tôi"
            >
              <svg
                aria-hidden="true"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                <circle cx="12" cy="13" r="4" />
              </svg>
              <span className={styles.cameraText}>Tài khoản</span>
            </Link>
            <AuthPanel />
          </div>
        </div>
      </header>
    </>
  );
}
