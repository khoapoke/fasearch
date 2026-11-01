"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useCart } from "./storefront-client";
import { authMe, type AuthIdentity } from "@/lib/customer-auth-client";
import { useCustomerCart } from "@/components/customer-commerce/customer-cart-provider";
import "./customer-header.css";
import { ThemeControl } from "@/components/studio/theme-control";

/**
 * CONTROL-HEADER-04 — header Customer đã duyệt (6fdbcee), dùng lại được nhưng
 * chỉ Home bật (`header="customer"`). Port từ app.js appHeader()/brandHTML()/
 * icon("bag")/aiViewfinderIcon() + styles.css:98-113,502-503,525-528,548-550,
 * 599-608,790,834-836. Không dùng router/toolbar/cart minh họa của prototype.
 */

type NavKey = "ai" | "products" | "account";

const NAV: { key: NavKey; href: string; label: string }[] = [
  { key: "ai", href: "/tim-kiem-ai", label: "Tìm bằng AI" },
  { key: "products", href: "/nam", label: "Sản phẩm" },
  { key: "account", href: "/tai-khoan", label: "Tài khoản" },
];

// Reference gộp listing/detail vào "Sản phẩm" và account family vào "Tài khoản";
// Home (active="/") không mục nào là trang hiện tại.
const PRODUCT_PATHS = ["/nam", "/nu", "/hang-moi", "/bo-suu-tap", "/sale"];

function currentFor(key: NavKey, active?: string) {
  if (!active) return undefined;
  if (key === "ai") return active === "/tim-kiem-ai" ? "page" : undefined;
  if (key === "products") return PRODUCT_PATHS.includes(active) ? "page" : undefined;
  return active.startsWith("/tai-khoan") ? "page" : undefined;
}

function FaSearchMark() {
  return (
    <svg className="chMark" aria-hidden="true" focusable="false" viewBox="0 0 40 40" fill="none">
      <path d="M27 3h10v10M13 37H3V27" stroke="currentColor" strokeWidth="2" />
      <path
        d="m14 10 6 3 6-3 8 6-4 6-4-2v12H14V20l-4 2-4-6 8-6Z"
        fill="#d6ef72"
        stroke="#20211f"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function AiViewfinder() {
  return (
    <svg
      className="chViewfinder"
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M1 5V1h4M11 1h4v4M15 11v4h-4M5 15H1v-4" />
      <circle cx="8" cy="8" r="2.2" style={{ fill: "var(--st-citron)" }} stroke="#20211f" strokeWidth="1" />
    </svg>
  );
}

function BagIcon() {
  return (
    <svg
      className="chBag"
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 7h14l-1.2 10H4.2L3 7Z" />
      <path d="M7 7V5a3 3 0 0 1 6 0v2" />
    </svg>
  );
}

export function CustomerHeader({ active, focused = false }: { active?: string; focused?: boolean }) {
  // Authenticated cart count comes from the server provider; guest draft is a
  // labelled browser-only fallback, never a second authoritative cart.
  const customerCart = useCustomerCart();
  const guestCount = useCart().reduce((sum, line) => sum + (line.qty || 0), 0);
  const count = customerCart.authState === "authenticated"
    ? customerCart.cart?.totalItems ?? 0
    : customerCart.authState === "guest" ? guestCount : 0;
  const detailsRef = useRef<HTMLDetailsElement | null>(null);
  const [identity, setIdentity] = useState<AuthIdentity | null>(null);
  const [identityLoading, setIdentityLoading] = useState(true);
  useEffect(() => {
    let active = true;
    authMe().then((r) => { if (active) { setIdentity(r); setIdentityLoading(false); } }).catch(() => { if (active) { setIdentity(null); setIdentityLoading(false); } });
    return () => { active = false; };
  }, []);

  // Details tự lo Enter/Space; thêm Escape/click-ngoài/điều hướng để menu đóng
  // đúng như một disclosure (không phải dialog, không bẫy tiêu điểm).
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const details = detailsRef.current;
      if (event.key !== "Escape" || !details?.open) return;
      details.open = false;
      details.querySelector("summary")?.focus();
    };
    const onPointer = (event: PointerEvent) => {
      const details = detailsRef.current;
      if (details?.open && !details.contains(event.target as Node)) details.open = false;
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, []);

  const closeMenu = () => {
    if (detailsRef.current) detailsRef.current.open = false;
  };

  if (focused) {
    return (
      <header className="chHeader chAuthHeader">
        <Link className="chBrand" href="/" aria-label="FaSearch, trang chủ">
          <FaSearchMark />
          <span className="chWord">FaSearch</span>
        </Link>
        <Link className="chAuthBack" href="/">
          <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
            <path d="M17 10H3m6-6-6 6 6 6" />
          </svg>
          Trang chủ
        </Link>
      </header>
    );
  }

  return (
    <header className="chHeader">
      <Link className="chBrand" href="/" aria-label="FaSearch, trang chủ">
        <FaSearchMark />
        <span className="chWord">FaSearch</span>
      </Link>
      <div className="chActions">
        <nav className="chNav" aria-label="Điều hướng chính">
          {NAV.map((item) => {
            if (item.key !== "account") {
              return (
                <Link
                  key={item.key}
                  href={item.href}
                  aria-current={currentFor(item.key, active)}
                  className={item.key === "ai" ? "chAi" : undefined}
                >
                  {item.key === "ai" ? (
                    <span className="chAiIcon" aria-hidden="true">
                      <AiViewfinder />
                    </span>
                  ) : null}
                  {item.label}
                </Link>
              );
            }
            const accountHref = identity ? "/tai-khoan" : `/dang-nhap?next=${encodeURIComponent("/tai-khoan")}`;
            const accountLabel = identity ? (identity.username || "Tài khoản") : "Đăng nhập";
            return (
              <Link
                key={item.key}
                href={accountHref}
                aria-current={currentFor(item.key, active)}
                className={undefined}
              >
                {accountLabel}
              </Link>
            );
          })}
          {identity && (identity.role === "ADMIN" || identity.role === "STAFF") ? (
            <Link href="/quan-tri" className="chAdminEntry">Quản trị</Link>
          ) : null}
        </nav>
        <div className="chThemeCompact">
          <ThemeControl className="chThemeControl" />
        </div>
        <details
          className="chMobile"
          ref={detailsRef}
        >
          <summary>
            Menu
            <svg
              className="chChevron"
              aria-hidden="true"
              focusable="false"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="m4 6 4 4 4-4" />
            </svg>
          </summary>
          <nav aria-label="Điều hướng chính">
            {NAV.map((item) => {
              if (item.key !== "account") {
                return (
                  <Link
                    key={item.key}
                    href={item.href}
                    aria-current={currentFor(item.key, active)}
                    className={item.key === "ai" ? "chAi" : undefined}
                    onClick={closeMenu}
                  >
                    {item.key === "ai" ? (
                      <span className="chAiIcon" aria-hidden="true">
                        <AiViewfinder />
                      </span>
                    ) : null}
                    {item.label}
                  </Link>
                );
              }
              const accountHref = identity ? "/tai-khoan" : `/dang-nhap?next=${encodeURIComponent("/tai-khoan")}`;
              const accountLabel = identity ? (identity.username || "Tài khoản") : "Đăng nhập";
              return (
                <Link
                  key={item.key}
                  href={accountHref}
                  aria-current={currentFor(item.key, active)}
                  className={undefined}
                  onClick={closeMenu}
                >
                  {accountLabel}
                </Link>
              );
            })}
            {identity && (identity.role === "ADMIN" || identity.role === "STAFF") ? (
              <Link href="/quan-tri" className="chAdminEntry" onClick={closeMenu}>Quản trị</Link>
            ) : null}
          </nav>
        </details>
        <Link className="chCart" href="/gio-hang" aria-label={`Giỏ hàng, ${count} sản phẩm`}>
          <BagIcon />
          <span className="chCartLabel">Giỏ hàng</span>
          <span className="chCartCount">{count}</span>
        </Link>
      </div>
    </header>
  );
}
