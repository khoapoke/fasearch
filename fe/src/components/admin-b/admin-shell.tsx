"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { authLogout, authMe, AuthApiError, type AuthIdentity } from "@/lib/customer-auth-client";
import { Icon } from "./icons";
import "./admin-b.css";

type State = { kind: "loading" } | { kind: "guest" } | { kind: "denied" } | { kind: "error" } | { kind: "ready"; identity: AuthIdentity };

export function AdminShellB({ active, title, eyebrow, children }: { active: "overview" | "orders" | "customers" | "employees" | "internalAccounts" | "products" | "categories" | "stock" | "imports" | "exports" | "stocktakes" | "promotions" | "loyalty" | "reports"; title: string; eyebrow?: string; children: React.ReactNode }) {
  const [state, setState] = useState<State>({ kind: "loading" });
  const [dark, setDark] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState("");
  const router = useRouter();
  const [authRetry, setAuthRetry] = useState(0);
  const navRef = useRef<HTMLElement>(null);
  const navToggleRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const controller = new AbortController();
    authMe(controller.signal)
      .then((identity) => setState(identity.role === "ADMIN" || identity.role === "STAFF" ? { kind: "ready", identity } : { kind: "denied" }))
      .catch((failure) => {
        if (controller.signal.aborted) return;
        setState(failure instanceof AuthApiError && failure.status === 401 ? { kind: "guest" } : failure instanceof AuthApiError && failure.status === 403 ? { kind: "denied" } : { kind: "error" });
      });
    const saved = localStorage.getItem("fasearch-admin-theme");
    if (saved === "dark" || saved === "light") void Promise.resolve().then(() => setDark(saved === "dark"));
    return () => controller.abort();
  }, [authRetry]);

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
    setDark((current) => {
      const next = !current;
      localStorage.setItem("fasearch-admin-theme", next ? "dark" : "light");
      return next;
    });
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

  if (state.kind === "loading") return <div className="admB font-inter"><div className="workspace"><main id="main" className="admB-loading">Đang kiểm tra quyền quản trị…</main></div></div>;
  if (state.kind === "guest") {
    return <div className="admB font-inter"><div className="admB-gate"><h1>Không gian quản trị</h1><p>Cần đăng nhập bằng tài khoản ADMIN hoặc STAFF.</p><Link className="primary" href="/dang-nhap?next=%2Fquan-tri">Đăng nhập quản trị</Link></div></div>;
  }
  if (state.kind === "error") {
    return <div className="admB font-inter"><div className="admB-gate" role="alert"><h1>Chưa kiểm tra được phiên đăng nhập</h1><p>Dịch vụ tạm thời không sẵn sàng. Thử lại để kiểm tra quyền quản trị.</p><button className="primary" type="button" onClick={() => { setState({ kind: "loading" }); setAuthRetry((n) => n + 1); }}>Thử lại</button></div></div>;
  }
  if (state.kind === "denied") {
    return <div className="admB font-inter"><div className="admB-gate"><p className="section-label">FaSearch · Không gian nội bộ</p><h1>Không có quyền truy cập</h1><p>Tài khoản hiện tại không phải ADMIN hoặc STAFF. Dữ liệu quản trị không được tải.</p><Link className="text-link" href="/">Về trang chủ</Link></div></div>;
  }

  const role = state.identity.role;
  const adminOnly = ["employees", "internalAccounts", "promotions", "loyalty", "reports"].includes(active);
  return (
    <div className={`admB font-inter${dark ? " dark" : ""}${navOpen ? " nav-open" : ""}${role === "STAFF" ? " role-staff" : ""}`}>
      <a className="skip" href="#main">Bỏ qua tới nội dung</a>
      <div className="shell">
        <aside className="sidebar" id="nav" ref={navRef}>
          <div className="brand"><span className="brand-mark">F</span><span>FaSearch<small>Không gian quản trị</small></span></div>
          <nav aria-label="Điều hướng chính">
            <Link className={`nav-item${active === "overview" ? " active" : ""}`} href="/quan-tri" aria-current={active === "overview" ? "page" : undefined}><Icon name="layout-dashboard" /><span>Tổng quan</span></Link>
            <div className="nav-group">Vận hành</div>
            <Link className={`nav-item${active === "orders" ? " active" : ""}`} href="/quan-tri/don-hang" aria-current={active === "orders" ? "page" : undefined}><Icon name="shopping-bag" /><span>Đơn hàng</span></Link>
            <Link className={`nav-item${active === "customers" ? " active" : ""}`} href="/quan-tri/khach-hang" aria-current={active === "customers" ? "page" : undefined}><Icon name="users" /><span>Khách hàng</span></Link>
            {role === "ADMIN" ? <Link className={`nav-item${active === "employees" ? " active" : ""}`} href="/quan-tri/nhan-vien" aria-current={active === "employees" ? "page" : undefined}><Icon name="users" /><span>Nhân viên</span></Link> : null}
            {role === "ADMIN" ? <Link className={`nav-item${active === "internalAccounts" ? " active" : ""}`} href="/quan-tri/tai-khoan-noi-bo" aria-current={active === "internalAccounts" ? "page" : undefined}><Icon name="scroll-text" /><span>Tài khoản nội bộ</span></Link> : null}
            <Link className={`nav-item${active === "products" ? " active" : ""}`} href="/quan-tri/san-pham" aria-current={active === "products" ? "page" : undefined}><Icon name="package" /><span>Sản phẩm</span></Link>
            <Link className={`nav-item${active === "categories" ? " active" : ""}`} href="/quan-tri/danh-muc" aria-current={active === "categories" ? "page" : undefined}><Icon name="clipboard-list" /><span>Danh mục</span></Link>
            <Link className={`nav-item${active === "stock" ? " active" : ""}`} href="/quan-tri/ton-kho" aria-current={active === "stock" ? "page" : undefined}><Icon name="package" /><span>Tồn kho</span></Link>
            <Link className={`nav-item${active === "imports" ? " active" : ""}`} href="/quan-tri/phieu-nhap" aria-current={active === "imports" ? "page" : undefined}><Icon name="truck" /><span>Phiếu nhập</span></Link>
            <Link className={`nav-item${active === "exports" ? " active" : ""}`} href="/quan-tri/phieu-xuat" aria-current={active === "exports" ? "page" : undefined}><Icon name="package" /><span>Phiếu xuất</span></Link>
            <Link className={`nav-item${active === "stocktakes" ? " active" : ""}`} href="/quan-tri/kiem-ke" aria-current={active === "stocktakes" ? "page" : undefined}><Icon name="clipboard-list" /><span>Kiểm kê</span></Link>
            {role === "ADMIN" ? <div className="nav-group">Ưu đãi &amp; Báo cáo</div> : null}
            {role === "ADMIN" ? <Link className={`nav-item${active === "promotions" ? " active" : ""}`} href="/quan-tri/khuyen-mai" aria-current={active === "promotions" ? "page" : undefined}><Icon name="calendar-days" /><span>Khuyến mãi</span></Link> : null}
            {role === "ADMIN" ? <Link className={`nav-item${active === "loyalty" ? " active" : ""}`} href="/quan-tri/chinh-sach-diem" aria-current={active === "loyalty" ? "page" : undefined}><Icon name="scroll-text" /><span>Chính sách điểm</span></Link> : null}
            {role === "ADMIN" ? <Link className={`nav-item${active === "reports" ? " active" : ""}`} href="/quan-tri/bao-cao" aria-current={active === "reports" ? "page" : undefined}><Icon name="chart-no-axes-combined" /><span>Báo cáo</span></Link> : null}
          </nav>
          <div className="sidebar-bottom"><span className="fixture-dot" />Vận hành nội bộ · STAFF/ADMIN</div>
        </aside>
        <div className="workspace">
          <header className="appbar">
            <div className="location">
              <button className="icon-btn nav-toggle" type="button" ref={navToggleRef} aria-controls="nav" aria-label="Mở điều hướng" aria-expanded={navOpen} onClick={() => setNavOpen((open) => !open)}><Icon name="menu" /></button>
              <span>Không gian nội bộ</span><Icon name="chevron-right" /><strong>{title}</strong>
            </div>
            <div className="utilities">
              <button className="icon-btn" type="button" onClick={toggleTheme} aria-label={dark ? "Chuyển giao diện sáng" : "Chuyển giao diện tối"}><Icon name={dark ? "sun" : "moon"} /></button>
              <span className="user"><span className="avatar">{role === "STAFF" ? "NV" : "QT"}</span>{role === "STAFF" ? "Nhân viên" : "Quản trị"}</span>
              <button className="logout-btn" type="button" onClick={logout} disabled={loggingOut} aria-busy={loggingOut} aria-label={loggingOut ? "Đang đăng xuất" : "Đăng xuất khỏi phiên trình duyệt này"} title="Đăng xuất khỏi phiên trình duyệt này"><Icon name="log-out" /><span>{loggingOut ? "Đang đăng xuất…" : "Đăng xuất"}</span></button>
            </div>
          </header>
          {logoutError ? <p className="logout-error" role="alert">{logoutError}</p> : null}
          <main id="main" tabIndex={-1}>
            {eyebrow ? <p className="section-label">{eyebrow}</p> : null}
            {role === "STAFF" && adminOnly ? <div className="order-empty" role="status"><h1>Chỉ ADMIN được truy cập mục này</h1><p>Tài khoản STAFF không có quyền quản lý nội dung này.</p><Link className="text-link" href="/quan-tri">Về Tổng quan</Link></div> : children}
          </main>
        </div>
      </div>
    </div>
  );
}
