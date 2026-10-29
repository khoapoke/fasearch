"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { useCart } from "./storefront-client";
import "./customer-header.css";

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

export function CustomerHeader({ active }: { active?: string }) {
  // Count thật từ cart store hiện có; hiển thị cả 0 (khác CartCount cũ ẩn 0).
  const count = useCart().reduce((sum, line) => sum + (line.qty || 0), 0);
  const detailsRef = useRef<HTMLDetailsElement | null>(null);

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

  return (
    <header className="chHeader">
      <Link className="chBrand" href="/" aria-label="FaSearch, trang chủ">
        <FaSearchMark />
        <span className="chWord">FaSearch</span>
      </Link>
      <div className="chActions">
        <nav className="chNav" aria-label="Điều hướng chính">
          {NAV.map((item) => (
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
          ))}
        </nav>
        <details
          className="chMobile"
          ref={detailsRef}
        >
          <summary>Menu</summary>
          <nav aria-label="Điều hướng chính">
            {NAV.map((item) => (
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
            ))}
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
