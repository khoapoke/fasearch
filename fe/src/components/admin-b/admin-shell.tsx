"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { authMe, AuthApiError, type AuthIdentity } from "@/lib/customer-auth-client";
import { Icon } from "./icons";
import "./admin-b.css";

type State = { kind: "loading" } | { kind: "guest" } | { kind: "denied" } | { kind: "ready"; identity: AuthIdentity };

export function AdminShellB({ active, title, eyebrow, children }: { active: "overview" | "orders" | "products" | "categories" | "stock" | "imports" | "exports" | "stocktakes"; title: string; eyebrow?: string; children: React.ReactNode }) {
  const [state, setState] = useState<State>({ kind: "loading" });
  const [dark, setDark] = useState(false);
  const [navOpen, setNavOpen] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    authMe(controller.signal)
      .then((identity) => setState(identity.role === "ADMIN" || identity.role === "STAFF" ? { kind: "ready", identity } : { kind: "denied" }))
      .catch((failure) => {
        if (controller.signal.aborted) return;
        setState(failure instanceof AuthApiError && failure.status === 401 ? { kind: "guest" } : { kind: "denied" });
      });
    const saved = localStorage.getItem("fasearch-admin-theme");
    if (saved === "dark" || saved === "light") void Promise.resolve().then(() => setDark(saved === "dark"));
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape" && navOpen) { setNavOpen(false); } };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [navOpen]);

  function toggleTheme() {
    setDark((current) => {
      const next = !current;
      localStorage.setItem("fasearch-admin-theme", next ? "dark" : "light");
      return next;
    });
  }

  if (state.kind === "loading") return <div className="admB font-inter"><div className="workspace"><main id="main" className="admB-loading">Đang kiểm tra quyền quản trị…</main></div></div>;
  if (state.kind === "guest") {
    return <div className="admB font-inter"><div className="admB-gate"><h1>Không gian quản trị</h1><p>Cần đăng nhập bằng tài khoản ADMIN hoặc STAFF.</p><Link className="primary" href="/dang-nhap?next=%2Fquan-tri">Đăng nhập quản trị</Link></div></div>;
  }
  if (state.kind === "denied") {
    return <div className="admB font-inter"><div className="admB-gate"><p className="section-label">FaSearch · Không gian nội bộ</p><h1>Không có quyền truy cập</h1><p>Tài khoản hiện tại không phải ADMIN hoặc STAFF. Dữ liệu quản trị không được tải.</p><Link className="text-link" href="/">Về trang chủ</Link></div></div>;
  }

  const role = state.identity.role;
  return (
    <div className={`admB font-inter${dark ? " dark" : ""}${navOpen ? " nav-open" : ""}${role === "STAFF" ? " role-staff" : ""}`}>
      <a className="skip" href="#main">Bỏ qua tới nội dung</a>
      <div className="shell">
        <aside className="sidebar" id="nav">
          <div className="brand"><span className="brand-mark">F</span><span>FaSearch<small>Không gian quản trị</small></span></div>
          <nav aria-label="Điều hướng chính">
            <Link className={`nav-item${active === "overview" ? " active" : ""}`} href="/quan-tri" aria-current={active === "overview" ? "page" : undefined}><Icon name="layout-dashboard" /><span>Tổng quan</span></Link>
            <div className="nav-group">Vận hành</div>
            <Link className={`nav-item${active === "orders" ? " active" : ""}`} href="/quan-tri/don-hang" aria-current={active === "orders" ? "page" : undefined}><Icon name="shopping-bag" /><span>Đơn hàng</span></Link>
            <Link className={`nav-item${active === "products" ? " active" : ""}`} href="/quan-tri/san-pham" aria-current={active === "products" ? "page" : undefined}><Icon name="package" /><span>Sản phẩm</span></Link>
            <Link className={`nav-item${active === "categories" ? " active" : ""}`} href="/quan-tri/danh-muc" aria-current={active === "categories" ? "page" : undefined}><Icon name="clipboard-list" /><span>Danh mục</span></Link>
            <Link className={`nav-item${active === "stock" ? " active" : ""}`} href="/quan-tri/ton-kho" aria-current={active === "stock" ? "page" : undefined}><Icon name="package" /><span>Tồn kho</span></Link>
            <Link className={`nav-item${active === "imports" ? " active" : ""}`} href="/quan-tri/phieu-nhap" aria-current={active === "imports" ? "page" : undefined}><Icon name="truck" /><span>Phiếu nhập</span></Link>
            <Link className={`nav-item${active === "exports" ? " active" : ""}`} href="/quan-tri/phieu-xuat" aria-current={active === "exports" ? "page" : undefined}><Icon name="package" /><span>Phiếu xuất</span></Link>
            <Link className={`nav-item${active === "stocktakes" ? " active" : ""}`} href="/quan-tri/kiem-ke" aria-current={active === "stocktakes" ? "page" : undefined}><Icon name="clipboard-list" /><span>Kiểm kê</span></Link>
          </nav>
          <div className="sidebar-bottom"><span className="fixture-dot" />Đơn thật · tài chính preview</div>
        </aside>
        <div className="workspace">
          <header className="appbar">
            <div className="location">
              <button className="icon-btn nav-toggle" type="button" aria-label="Mở điều hướng" aria-expanded={navOpen} onClick={() => setNavOpen((open) => !open)}><Icon name="menu" /></button>
              <span>Không gian nội bộ</span><Icon name="chevron-right" /><strong>{title}</strong>
            </div>
            <div className="utilities">
              <button className="icon-btn" type="button" onClick={toggleTheme} aria-label={dark ? "Chuyển giao diện sáng" : "Chuyển giao diện tối"}><Icon name={dark ? "sun" : "moon"} /></button>
              <span className="user"><span className="avatar">{role === "STAFF" ? "NV" : "QT"}</span>{role === "STAFF" ? "Nhân viên" : "Quản trị"}</span>
            </div>
          </header>
          <main id="main" tabIndex={-1}>
            {eyebrow ? <p className="section-label">{eyebrow}</p> : null}
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
