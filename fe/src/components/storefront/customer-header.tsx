"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useCart } from "./storefront-client";
import { authMe, AuthApiError, isAuthAbort } from "@/lib/customer-auth-client";
import { resolveHeaderAccountNav, type CustomerHeaderAuthState } from "@/lib/customer-header-nav";
import { useCustomerCart } from "@/components/customer-commerce/customer-cart-provider";
import "./customer-header.css";
import { CustomerThemeMenu } from "./customer-theme-menu";
import { useStickyHeader } from "@/lib/sticky-header";
import { useHomeMotion } from "@/lib/home-motion";

/**
 * CONTROL-HEADER-04 — header Customer đã duyệt (6fdbcee), dùng chung cho các
 * route Customer qua `header="customer"` / `header="customer-focused"`. Port từ app.js appHeader()/brandHTML()/
 * icon("bag")/aiViewfinderIcon() + styles.css:98-113,502-503,525-528,548-550,
 * 599-608,790,834-836. Không dùng router/toolbar/cart minh họa của prototype.
 */

type NavKey = "ai" | "products" | "brands" | "offers" | "account";

const NAV: { key: NavKey; href: string; label: string }[] = [
  { key: "ai", href: "/tim-kiem-ai", label: "Tìm bằng AI" },
  { key: "products", href: "/nam", label: "Sản phẩm" },
  { key: "brands", href: "/#thuong-hieu", label: "Thương hiệu" },
  { key: "offers", href: "/voucher", label: "Ưu đãi" },
  { key: "account", href: "/tai-khoan", label: "Tài khoản" },
];

// Reference gộp listing/detail vào "Sản phẩm" và account family vào "Tài khoản";
// Home (active="/") không mục nào là trang hiện tại.
const PRODUCT_PATHS = ["/nam", "/nu", "/hang-moi", "/bo-suu-tap", "/sale"];

function currentFor(key: NavKey, active?: string) {
  if (!active) return undefined;
  if (key === "ai") return active === "/tim-kiem-ai" ? "page" : undefined;
  if (key === "products") return PRODUCT_PATHS.includes(active) ? "page" : undefined;
  if (key === "brands") return active === "/#thuong-hieu" || active === "/thuong-hieu" ? "page" : undefined;
  if (key === "offers") return active === "/voucher" ? "page" : undefined;
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
  // Chỉ một menu mở tại một thời điểm: mở popover giao diện sẽ đóng menu mobile.
  const [themeOpen, setThemeOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [focusInside, setFocusInside] = useState(false);
  const { enabled: motionOn } = useHomeMotion();
  // Menu mở hoặc tiêu điểm bàn phím trong header → không tự mở rộng khi cuộn.
  const compact = useStickyHeader({ frozen: menuOpen || focusInside, enabled: motionOn });
  const headerRef = useRef<HTMLElement | null>(null);
  const mountedRef = useRef(true);
  const [authState, setAuthState] = useState<CustomerHeaderAuthState>({ status: "loading" });

  const load = useCallback(() => {
    // Clear previous identity immediately during account switch/reloads so stale identities are never shown
    setAuthState({ status: "loading" });
    authMe()
      .then((identity) => {
        if (mountedRef.current) setAuthState({ status: "authenticated", identity });
      })
      .catch((err) => {
        if (!mountedRef.current || isAuthAbort(err)) return;
        if (err instanceof AuthApiError) {
          if (err.status === 401) {
            setAuthState({ status: "guest" });
            return;
          }
          if (err.status === 403) {
            setAuthState({ status: "forbidden", message: err.message });
            return;
          }
        }
        setAuthState({ status: "error", message: err instanceof Error ? err.message : String(err) });
      });
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    load();
    window.addEventListener("fasearch-auth-change", load);
    window.addEventListener("focus", load);
    return () => {
      mountedRef.current = false;
      window.removeEventListener("fasearch-auth-change", load);
      window.removeEventListener("focus", load);
    };
  }, [load]);

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

  const navModel = resolveHeaderAccountNav(authState);

  // Compact chỉ còn logo icon: hai cụm hai bên bị `inert` (không tab, không bấm)
  // để không có "ô focus vô hình". Logo ở giữa luôn hiện và là cửa vào bàn phím:
  // focus vào logo (hoặc chạm) mở lại toàn bộ nav TRƯỚC khi người dùng Tab tiếp.
  const clustersInert = compact && !menuOpen && !focusInside;

  return (
    <header
      className="chHeader"
      data-compact={compact ? "true" : "false"}
      data-menu-open={menuOpen ? "true" : "false"}
      ref={headerRef}
      onFocusCapture={() => setFocusInside(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setFocusInside(false);
      }}
    >
      <div className="chHeaderInner">
        {/* Cột trái: hamburger (mobile) + liên kết khám phá (desktop).
            Khi cuộn xuống, cả cột và cột phải ẩn khỏi màn hình nhưng vẫn ở DOM
            (aria-hidden + inert qua CSS visibility) để tiêu điểm bàn phím có thể
            kéo chúng trở lại thay vì mất hút. */}
        <div className="chLeft" {...(clustersInert ? { inert: true } : {})}>
          <details
            className="chMobile"
            ref={detailsRef}
            onToggle={(event) => {
              const open = event.currentTarget.open;
              setMenuOpen(open);
              if (open) setThemeOpen(false);
            }}
          >
            <summary aria-label="Mở menu điều hướng" title="Menu">
              <svg className="chMenuIcon" aria-hidden="true" focusable="false" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                <path d="M3 5.5h14M3 10h14M3 14.5h14" />
              </svg>
            </summary>
            <nav aria-label="Điều hướng chính">
              {NAV.map((item) => (
                <Link
                  key={item.key}
                  href={item.key === "account" ? navModel.href : item.href}
                  aria-current={currentFor(item.key, active)}
                  aria-label={item.key === "account" ? navModel.ariaLabel : undefined}
                  className={item.key === "ai" ? "chAi" : undefined}
                  onClick={() => {
                    closeMenu();
                    if (item.key === "account" && navModel.status === "error") load();
                  }}
                >
                  {item.key === "ai" ? (
                    <span className="chAiIcon" aria-hidden="true"><AiViewfinder /></span>
                  ) : null}
                  {item.key === "account" ? navModel.label : item.label}
                </Link>
              ))}
              {navModel.showAdminEntry ? (
                <Link href="/quan-tri" className="chAdminEntry" onClick={closeMenu}>Quản trị</Link>
              ) : null}
            </nav>
          </details>

          <nav className="chNav" aria-label="Khám phá">
            {NAV.filter((item) => item.key !== "account").map((item) => (
              <Link
                key={item.key}
                href={item.href}
                aria-current={currentFor(item.key, active)}
                className={item.key === "ai" ? "chAi" : undefined}
              >
                {item.key === "ai" ? (
                  <span className="chAiIcon" aria-hidden="true"><AiViewfinder /></span>
                ) : null}
                {item.label}
              </Link>
            ))}
          </nav>
        </div>

        {/* Cột giữa: thương hiệu luôn căn giữa hình học. Down-scroll chỉ còn mark;
            wordmark ẩn bằng opacity/transform (không đổi kích thước hit target). */}
        <Link
          className="chBrand"
          href="/"
          aria-label="FaSearch, về trang chủ"
          title="FaSearch"
          onFocus={() => setFocusInside(true)}
          onPointerDown={() => setFocusInside(true)}
        >
          <FaSearchMark />
          <span className="chWord">FaSearch</span>
        </Link>

        {/* Cột phải: tài khoản (desktop), giao diện, giỏ hàng. */}
        <div className="chRight" {...(clustersInert ? { inert: true } : {})}>
          <nav className="chNav chNavAccount" aria-label="Tài khoản">
            <Link
              href={navModel.href}
              aria-current={currentFor("account", active)}
              aria-label={navModel.ariaLabel}
              title={navModel.title}
              onClick={navModel.status === "error" ? () => { load(); } : undefined}
            >
              {navModel.label}
            </Link>
            {navModel.showAdminEntry ? (
              <Link href="/quan-tri" className="chAdminEntry">Quản trị</Link>
            ) : null}
          </nav>
          <div className="chThemeCompact">
            <CustomerThemeMenu
              open={themeOpen}
              onOpenChange={(next) => {
                if (next) closeMenu();
                setThemeOpen(next);
              }}
            />
          </div>
          <Link className="chCart" href="/gio-hang" aria-label={`Giỏ hàng, ${count} sản phẩm`}>
            <BagIcon />
            <span className="chCartLabel">Giỏ hàng</span>
            <span className="chCartCount">{count}</span>
          </Link>
        </div>
      </div>
    </header>
  );
}
