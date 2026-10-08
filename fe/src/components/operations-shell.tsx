"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./operations-shell.module.css";

type CurrentUser = { username: string; authorities: string[] };

export function OperationsShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [meState, setMeState] = useState<"loading" | "ready" | "expired">("loading");

  useEffect(() => {
    let active = true;
    fetch("/api/auth/me", { cache: "no-store" })
      .then(async (response) => {
        if (!active) return;
        if (response.ok) {
          setUser((await response.json()) as CurrentUser);
          setMeState("ready");
        } else {
          setMeState("expired");
        }
      })
      .catch(() => {
        if (active) setMeState("expired");
      });
    return () => {
      active = false;
    };
  }, []);

  const canOperate =
    user != null &&
    (user.authorities.includes("CATALOG_DRAFT_WRITE") ||
      user.authorities.includes("CATALOG_PUBLISH"));
  const isAdmin = user?.authorities.includes("CATALOG_PUBLISH") ?? false;

  return (
    <main className={styles.wrap}>
      <nav className={styles.crumbs} aria-label="Đường dẫn">
        <Link href="/">FaSearch</Link>
        <span aria-hidden="true">/</span>
        <Link
          href="/catalog/operations"
          aria-current={pathname === "/catalog/operations" ? "page" : undefined}
        >
          Quản lý catalog
        </Link>
      </nav>
      <header className={styles.header}>
        <div>
          <p className={styles.kicker}>Không gian vận hành</p>
          <h1 className={styles.title}>Quản lý catalog</h1>
        </div>
        <div className={styles.identity} role="status" aria-live="polite">
          {meState === "loading" && <span>Đang kiểm tra quyền…</span>}
          {meState === "expired" && (
            <span>
              Phiên đăng nhập đã hết hạn. <Link href="/account">Đăng nhập lại</Link>
            </span>
          )}
          {meState === "ready" && user && (
            <span>
              {user.username} · {isAdmin ? "Quản trị viên" : "Nhân viên vận hành"}
            </span>
          )}
        </div>
      </header>
      <nav className={styles.tabs} aria-label="Điều hướng vận hành">
        <Link
          href="/catalog/operations"
          aria-current={pathname === "/catalog/operations" ? "page" : undefined}
        >
          Tổng quan
        </Link>
        <Link
          href="/catalog/drafts"
          aria-current={pathname?.startsWith("/catalog/drafts") ? "page" : undefined}
        >
          Sản phẩm nháp
        </Link>
        <Link href="/catalog/drafts/new">Tạo sản phẩm nháp</Link>
        <Link href="/catalog">Về catalog công khai</Link>
      </nav>
      {meState === "ready" && !canOperate && (
        <div className={styles.denied} role="alert">
          <p>
            Tài khoản này không có quyền vận hành catalog. Nội dung dưới đây bị
            giới hạn; máy chủ vẫn kiểm tra quyền cho mọi yêu cầu.
          </p>
        </div>
      )}
      {children}
    </main>
  );
}
