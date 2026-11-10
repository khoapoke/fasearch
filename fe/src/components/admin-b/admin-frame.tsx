"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { authLogout, authMe, AuthApiError, type AuthIdentity } from "@/lib/customer-auth-client";
import { roleLabel } from "@/lib/admin-people-client";
import { hasPermission, routePermission, type PermissionCode } from "@/lib/admin-roles";
import { Icon } from "./icons";
import { ToastProvider } from "./toast";
import { NotificationBell } from "./notification-bell";
import "./admin-b.css";
import "./o1.css";

type State = { kind: "loading" } | { kind: "guest" } | { kind: "denied" } | { kind: "error" } | { kind: "ready"; identity: AuthIdentity };

const THEME_KEY = "fasearch-admin-theme";

/** `perm`: quyền xem của mục; thiếu quyền thì mục bị ẩn (ADMIN luôn thấy). */
type NavItem = { href: string; label: string; icon: string; adminOnly?: boolean; pending?: boolean; perm?: PermissionCode };
const NAV: { label: string | null; items: NavItem[] }[] = [
  { label: null, items: [{ href: "/quan-tri", label: "Dashboard", icon: "layout-dashboard" }] },
  {
    label: "Bán hàng",
    items: [
      { href: "/quan-tri/don-hang", label: "Đơn hàng", icon: "shopping-bag", pending: true, perm: "ORDER_VIEW" },
      { href: "/quan-tri/doi-tra", label: "Đổi/trả", icon: "arrow-down-to-line", perm: "RETURN_VIEW" },
      { href: "/quan-tri/khach-hang", label: "Khách hàng", icon: "users", perm: "CUSTOMER_VIEW" },
      { href: "/quan-tri/khuyen-mai", label: "Khuyến mãi", icon: "ticket-percent", perm: "PROMOTION_VIEW" },
      { href: "/quan-tri/chinh-sach-diem", label: "Chính sách điểm", icon: "star", perm: "LOYALTY_POLICY_VIEW" },
    ],
  },
  {
    label: "Hàng hóa",
    items: [
      { href: "/quan-tri/san-pham", label: "Sản phẩm", icon: "shirt", perm: "PRODUCT_VIEW" },
      { href: "/quan-tri/danh-muc", label: "Danh mục", icon: "tags", perm: "PRODUCT_VIEW" },
    ],
  },
  {
    label: "Kho",
    items: [
      { href: "/quan-tri/ton-kho", label: "Tồn kho", icon: "boxes", perm: "INVENTORY_VIEW" },
      { href: "/quan-tri/phieu-nhap", label: "Phiếu nhập", icon: "arrow-down-to-line", perm: "INVENTORY_VIEW" },
      { href: "/quan-tri/phieu-xuat", label: "Phiếu xuất", icon: "arrow-up-from-line", perm: "INVENTORY_VIEW" },
      { href: "/quan-tri/kiem-ke", label: "Kiểm kê", icon: "clipboard-check", perm: "INVENTORY_VIEW" },
    ],
  },
  { label: "Phân tích", items: [{ href: "/quan-tri/bao-cao", label: "Report", icon: "chart-no-axes-combined", perm: "REPORT_VIEW" }] },
  {
    label: "Hệ thống",
    items: [
      { href: "/quan-tri/nhan-vien", label: "Nhân sự", icon: "user-cog", perm: "EMPLOYEE_VIEW" },
      { href: "/quan-tri/tai-khoan-noi-bo", label: "Tài khoản nội bộ", icon: "key-round", adminOnly: true },
      { href: "/quan-tri/nhat-ky", label: "Nhật ký hoạt động", icon: "clipboard-check", perm: "AUDIT_VIEW" },
      { href: "/quan-tri/thung-rac", label: "Thùng rác", icon: "trash-2", perm: "TRASH_VIEW" },
    ],
  },
];
const ALL_ITEMS = NAV.flatMap((g) => g.items);

/** Longest-prefix match so the highlighted item always follows the URL. */
function activeHref(pathname: string): string | null {
  let best: string | null = null;
  for (const item of ALL_ITEMS) {
    const hit = item.href === "/quan-tri" ? pathname === "/quan-tri" : pathname === item.href || pathname.startsWith(`${item.href}/`);
    if (hit && (!best || item.href.length > best.length)) best = item.href;
  }
  return best;
}

/** Pages set the appbar title through AdminShellB. */
export const AdminTitleContext = createContext<((title: string) => void) | null>(null);
/** Identity of the signed-in operator; null until the gate is open. Read it with useAdminIdentity(). */
export const AdminIdentityContext = createContext<AuthIdentity | null>(null);
export function useAdminIdentity(): AuthIdentity | null { return useContext(AdminIdentityContext); }
export const ORDERS_CHANGED_EVENT = "admin:orders-changed";
/** Call after an order status changes so the sidebar pill refreshes. */
export function notifyOrdersChanged() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(ORDERS_CHANGED_EVENT));
}

const subscribeNever = () => () => {};

/** The boot script sets the attribute on a hard load; client navigation from the storefront reads the saved choice here. */
function initialDark(): boolean {
  if (typeof document === "undefined") return false;
  const attr = document.documentElement.dataset.adminTheme;
  if (attr === "dark" || attr === "light") return attr === "dark";
  try { return localStorage.getItem(THEME_KEY) === "dark"; } catch { return false; }
}

export function AdminFrame({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<State>({ kind: "loading" });
  const [dark, setDark] = useState(initialDark);
  // SSR cannot know the saved theme and React keeps server attributes while hydrating,
  // so the toggle's icon and label switch to the real theme only after hydration.
  const hydrated = useSyncExternalStore(subscribeNever, () => true, () => false);
  const showDark = hydrated && dark;
  const [title, setTitle] = useState("");
  const [navOpen, setNavOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState("");
  const [pending, setPending] = useState<number | null>(null);
  const router = useRouter();
  const pathname = usePathname();
  const rootRef = useRef<HTMLDivElement>(null);
  const navRef = useRef<HTMLElement>(null);
  const navToggleRef = useRef<HTMLButtonElement>(null);

  // The SSR root cannot know the saved theme, so the class is applied here on every render.
  useLayoutEffect(() => { rootRef.current?.classList.toggle("dark", dark); });
  // Before first paint, so html and frame agree on the theme even when the boot script did not run.
  useLayoutEffect(() => {
    if (!document.documentElement.dataset.adminTheme) document.documentElement.dataset.adminTheme = dark ? "dark" : "light";
  }, [dark]);

  // One gate check. `silent` re-checks (route change, tab focus) never show a loading state and
  // keep the current page on a transient failure; only 401 and 403 move the gate.
  const check = useCallback((signal: AbortSignal, silent: boolean) => {
    authMe(signal)
      .then((identity) => {
        if (signal.aborted) return;
        if (identity.role !== "ADMIN" && identity.role !== "STAFF") { setState({ kind: "denied" }); return; }
        // Quyền có thể đổi giữa hai lần kiểm tra (Quản trị viên bật/tắt): so cả danh sách quyền.
        setState((prev) => prev.kind === "ready" && prev.identity.id === identity.id && prev.identity.role === identity.role
          && (prev.identity.permissions ?? []).join(",") === (identity.permissions ?? []).join(",") ? prev : { kind: "ready", identity });
      })
      .catch((failure) => {
        if (signal.aborted) return;
        if (failure instanceof AuthApiError && failure.status === 401) setState({ kind: "guest" });
        else if (failure instanceof AuthApiError && failure.status === 403) setState({ kind: "denied" });
        else if (!silent) setState({ kind: "error" });
      });
  }, []);
  const silentRef = useRef<AbortController | null>(null);
  const recheck = useCallback(() => {
    silentRef.current?.abort();
    const controller = new AbortController();
    silentRef.current = controller;
    check(controller.signal, true);
  }, [check]);

  useEffect(() => {
    const controller = new AbortController();
    check(controller.signal, false);
    return () => controller.abort();
  }, [check]);

  // A session can end in another tab: re-check on every admin navigation and when the tab is shown again.
  const checkedPath = useRef(pathname);
  useEffect(() => {
    if (checkedPath.current === pathname) return;
    checkedPath.current = pathname;
    recheck();
  }, [pathname, recheck]);
  useEffect(() => {
    const onVisible = () => { if (document.visibilityState === "visible") recheck(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => { document.removeEventListener("visibilitychange", onVisible); silentRef.current?.abort(); };
  }, [recheck]);

  const ready = state.kind === "ready";
  const permissions = state.kind === "ready" ? state.identity.permissions : undefined;
  const canOrders = state.kind === "ready" && hasPermission(state.identity.role, permissions, "ORDER_VIEW");
  const loadPending = useCallback((signal?: AbortSignal) => {
    fetch("/api/admin/orders?status=PENDING&size=1", { cache: "no-store", signal })
      .then((r) => r.json())
      .then((j) => { if (j?.success && typeof j.result?.totalElements === "number") setPending(j.result.totalElements); })
      .catch(() => {});
  }, []);
  useEffect(() => {
    if (!ready || !canOrders) return;
    const controller = new AbortController();
    loadPending(controller.signal);
    const onChange = () => loadPending();
    window.addEventListener(ORDERS_CHANGED_EVENT, onChange);
    return () => { controller.abort(); window.removeEventListener(ORDERS_CHANGED_EVENT, onChange); };
  }, [ready, canOrders, pathname, loadPending]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape" && navOpen) { setNavOpen(false); navToggleRef.current?.focus(); } };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [navOpen]);

  useEffect(() => {
    if (navOpen && window.matchMedia("(max-width: 900px)").matches) {
      navRef.current?.querySelector<HTMLAnchorElement>("a[href]")?.focus();
    }
  }, [navOpen]);

  function toggleTheme() {
    const next = !dark;
    document.documentElement.dataset.adminTheme = next ? "dark" : "light";
    try { localStorage.setItem(THEME_KEY, next ? "dark" : "light"); } catch {}
    setDark(next);
  }

  // Kết thúc phiên trình duyệt (xóa cookie đăng nhập tại BFF + cache phía client);
  // không thu hồi token phía máy chủ.
  async function logout() {
    if (loggingOut) return;
    setLoggingOut(true);
    setLogoutError("");
    try {
      await authLogout();
      router.replace("/dang-nhap?next=%2Fquan-tri");
      router.refresh();
    } catch (failure) {
      setLogoutError(failure instanceof Error && failure.message ? failure.message : "Không thể đăng xuất. Thử lại.");
      setLoggingOut(false);
    }
  }

  const titleSetter = useMemo(() => (value: string) => setTitle(value), []);
  const rootClass = `admB font-inter${navOpen ? " nav-open" : ""}`;
  const role = state.kind === "ready" ? state.identity.role : null;
  const current = activeHref(pathname);
  const adminOnly = ["/quan-tri/tai-khoan-noi-bo"].some((path) => pathname === path || pathname.startsWith(`${path}/`));
  const neededPermission = routePermission(pathname);
  const missingPermission = role && neededPermission && !hasPermission(role, permissions, neededPermission) ? neededPermission : null;

  if (state.kind === "guest") {
    return <div ref={rootRef} suppressHydrationWarning className={rootClass}><div className="admB-gate"><h1>Không gian quản trị</h1><p>Cần đăng nhập bằng tài khoản Quản trị viên hoặc Quản lý.</p><Link className="primary" href="/dang-nhap?next=%2Fquan-tri">Đăng nhập quản trị</Link></div></div>;
  }
  if (state.kind === "error") {
    return <div ref={rootRef} suppressHydrationWarning className={rootClass}><div className="admB-gate" role="alert"><h1>Chưa kiểm tra được phiên đăng nhập</h1><p>Dịch vụ tạm thời không sẵn sàng. Thử lại để kiểm tra quyền quản trị.</p><button className="primary" type="button" onClick={() => window.location.reload()}>Thử lại</button></div></div>;
  }
  if (state.kind === "denied") {
    return <div ref={rootRef} suppressHydrationWarning className={rootClass}><div className="admB-gate"><p className="section-label">FaSearch · Không gian nội bộ</p><h1>Không có quyền truy cập</h1><p>Tài khoản hiện tại không phải Quản trị viên hoặc Quản lý. Dữ liệu quản trị không được tải.</p><Link className="text-link" href="/">Về trang chủ</Link></div></div>;
  }

  return (
    <div ref={rootRef} suppressHydrationWarning className={rootClass}>
      <ToastProvider>
        <a className="skip" href="#main">Bỏ qua tới nội dung</a>
        <div className="shell">
          <aside className="sidebar" id="nav" ref={navRef}>
            <div className="brand"><span className="brand-mark">F</span><span>FaSearch<small>Không gian quản trị</small></span></div>
            <nav aria-label="Điều hướng chính" onClick={(event) => { if ((event.target as HTMLElement).closest("a")) setNavOpen(false); }}>
              {NAV.map((group) => {
                const items = group.items.filter((item) => (!item.adminOnly || role === "ADMIN") && (!item.perm || hasPermission(role, permissions, item.perm)));
                if (!items.length) return null;
                return (
                  <div className="nav-section" key={group.label ?? "root"}>
                    {group.label ? <div className="nav-group">{group.label}</div> : null}
                    {items.map((item) => (
                      <Link key={item.href} className={`nav-item${current === item.href ? " active" : ""}`} href={item.href} aria-current={current === item.href ? "page" : undefined}>
                        <Icon name={item.icon} /><span>{item.label}</span>
                        {item.pending && pending && canOrders ? <span className="nav-pill" aria-label={`${pending} đơn mới`}>{pending > 99 ? "99+" : pending}</span> : null}
                      </Link>
                    ))}
                  </div>
                );
              })}
            </nav>
          </aside>
          <div className="workspace">
            <header className="appbar">
              <div className="location">
                <button className="icon-btn nav-toggle" type="button" ref={navToggleRef} aria-controls="nav" aria-label="Mở điều hướng" aria-expanded={navOpen} onClick={() => setNavOpen((open) => !open)}><Icon name="menu" /></button>
                <strong>{title}</strong>
              </div>
              <div className="utilities">
                {state.kind === "ready" ? <NotificationBell key={`${state.identity.id}:${(state.identity.permissions ?? []).join(",")}`} identity={state.identity} /> : null}
                <button className="icon-btn" type="button" onClick={toggleTheme} aria-label={showDark ? "Chuyển giao diện sáng" : "Chuyển giao diện tối"}><Icon name={showDark ? "sun" : "moon"} /></button>
                {role ? <span className="user"><span className="avatar">{role === "STAFF" ? "QL" : "QT"}</span>{roleLabel(role)}</span> : null}
                <button className="logout-btn" type="button" onClick={logout} disabled={loggingOut || !role} aria-busy={loggingOut} aria-label={loggingOut ? "Đang đăng xuất" : "Đăng xuất khỏi phiên trình duyệt này"} title="Đăng xuất khỏi phiên trình duyệt này"><Icon name="log-out" /><span>{loggingOut ? "Đang đăng xuất…" : "Đăng xuất"}</span></button>
              </div>
            </header>
            {logoutError ? <p className="logout-error" role="alert">{logoutError}</p> : null}
            <main id="main" tabIndex={-1}>
              {state.kind === "loading" ? (
                <div className="admB-loading" role="status">Đang kiểm tra quyền quản trị…</div>
              ) : role === "STAFF" && adminOnly ? (
                <div className="order-empty" role="status"><h1>Chỉ Quản trị viên hệ thống được truy cập mục này</h1><p>Tài khoản Quản lý không có quyền quản lý tài khoản và vai trò.</p><Link className="text-link" href="/quan-tri">Về Dashboard</Link></div>
              ) : missingPermission ? (
                <div className="order-empty o1-denied" role="status" data-missing-permission={missingPermission}><h1>Không có quyền</h1><p>Tài khoản Quản lý của bạn chưa được bật quyền dùng mục này. Liên hệ Quản trị viên nếu cần.</p><Link className="text-link" href="/quan-tri">Về Dashboard</Link></div>
              ) : (
                <AdminIdentityContext.Provider value={state.kind === "ready" ? state.identity : null}><AdminTitleContext.Provider value={titleSetter}>{children}</AdminTitleContext.Provider></AdminIdentityContext.Provider>
              )}
            </main>
          </div>
        </div>
      </ToastProvider>
    </div>
  );
}
