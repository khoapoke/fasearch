"use client";

import Link from "next/link";
import { AuthPanel } from "@/components/auth-panel";
import styles from "./site-header.module.css";

// Combined header: anchor navigation into the home image flow plus real
// routes for the three live search modes (IMAGE home, TEXT, COMPOSED).

const NAV = [
  { href: "/catalog", label: "Catalog" },
  { href: "/#tim-bang-anh", label: "Tìm bằng ảnh" },
  { href: "/search/text", label: "Tìm bằng chữ" },
  { href: "/search/composed", label: "Tìm kết hợp" },
  { href: "/#cach-hoat-dong", label: "Cách hoạt động" },
];

export function SiteHeader() {
  return (
    <>
      <p className={styles.promo}>
        FaSearch · Slice tìm kiếm bằng ảnh — catalog pilot được version hóa
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
          <nav className={styles.nav} aria-label="Điều hướng slice">
            {NAV.map((item) => (
              <Link key={item.href} href={item.href}>
                {item.label}
              </Link>
            ))}
          </nav>
          <div className={styles.actions}>
            <Link
              className={styles.cameraButton}
              href="/#tim-bang-anh"
              aria-label="Mở luồng tìm kiếm bằng ảnh"
              title="Tìm bằng ảnh"
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
              <span className={styles.cameraText}>Tìm bằng ảnh</span>
            </Link>
            <AuthPanel />
          </div>
        </div>
      </header>
    </>
  );
}
