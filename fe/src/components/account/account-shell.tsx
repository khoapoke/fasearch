"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  logout,
  readOwnProfile,
  type AccountProfile,
} from "@/components/account/account-session";
import styles from "@/components/account/account.module.css";

export type AccountNavKey = "hub" | "profile" | "security" | "saved" | "history";

const NAV: Array<{ key: AccountNavKey; href: string; label: string; tab: string }> = [
  { key: "hub", href: "/tai-khoan", label: "Tổng quan", tab: "Tổng quan" },
  { key: "profile", href: "/tai-khoan/thong-tin", label: "Thông tin cá nhân", tab: "Thông tin" },
  { key: "security", href: "/tai-khoan/bao-mat", label: "Bảo mật", tab: "Bảo mật" },
  { key: "saved", href: "/tai-khoan/san-pham-da-luu", label: "Sản phẩm đã lưu", tab: "Đã lưu" },
  { key: "history", href: "/tai-khoan/lich-su-tim-kiem", label: "Lịch sử tìm kiếm", tab: "Lịch sử" },
];

function initialsOf(profile: AccountProfile): string {
  const base = (profile.display_name || profile.username).trim();
  if (!base) return "?";
  const parts = base.split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function AccountShell({
  active,
  kicker,
  title,
  lede,
  crumb,
  children,
}: {
  active: AccountNavKey;
  kicker: string;
  title: string;
  lede: string;
  crumb: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [profile, setProfile] = useState<AccountProfile | null>(null);
  const [identityState, setIdentityState] = useState<"loading" | "ready" | "signedout">("loading");
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);

  useEffect(() => {
    let live = true;
    readOwnProfile()
      .then((result) => {
        if (!live) return;
        if (!result) {
          setIdentityState("signedout");
          router.replace(`/dang-nhap?next=${encodeURIComponent(pathname)}`);
          return;
        }
        setProfile(result);
        setIdentityState("ready");
      })
      .catch(() => {
        if (live) setIdentityState("signedout");
      });
    return () => {
      live = false;
    };
  }, [router, pathname]);

  async function signOut() {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    try {
      await logout();
      router.replace("/dang-nhap");
      router.refresh();
    } catch {
      busyRef.current = false;
      setBusy(false);
    }
  }

  return (
    <div className={styles.shell}>
      <nav className={styles.crumbs} aria-label="Đường dẫn">
        <Link href="/">Trang chủ</Link>
        <span aria-hidden="true">›</span>
        <Link href="/tai-khoan">Tài khoản của tôi</Link>
        <span aria-hidden="true">›</span>
        <span aria-current="page">{crumb}</span>
      </nav>
      <p className={styles.kicker}>{kicker}</p>
      <h1 className={styles.title}>{title}</h1>
      <p className={styles.lede}>{lede}</p>
      <div className={styles.grid}>
        <aside className={styles.side} aria-label="Tài khoản của tôi">
          <section className={styles.card} aria-label="Định danh tài khoản">
            {identityState === "ready" && profile ? (
              <div className={styles.identity}>
                <span className={styles.avatar} aria-hidden="true">
                  {initialsOf(profile)}
                </span>
                <div>
                  <p className={styles.greeting}>{profile.display_name || profile.username}</p>
                  <p className={styles.muted}>{profile.username}</p>
                  <p className={styles.muted}>{profile.email}</p>
                </div>
              </div>
            ) : identityState === "loading" ? (
              <div aria-label="Đang tải định danh">
                <div className={styles.skeleton} style={{ height: 28 }} />
                <div className={styles.skeleton} style={{ height: 18, marginTop: 12 }} />
              </div>
            ) : (
              <div>
                <p className={styles.greeting}>Chưa đăng nhập</p>
                <p className={styles.muted}>
                  <Link href="/dang-nhap">Đăng nhập</Link> để xem tài khoản của bạn.
                </p>
              </div>
            )}
          </section>
          <nav className={`${styles.card} ${styles.sideNav}`} aria-label="Quản lý tài khoản">
            {NAV.map((item) => (
              <Link
                key={item.key}
                href={item.href}
                aria-current={item.key === active ? "page" : undefined}
              >
                {item.label}
              </Link>
            ))}
            <button
              className={styles.logoutLink}
              type="button"
              onClick={signOut}
              disabled={busy || identityState !== "ready"}
            >
              {busy ? "Đang đăng xuất…" : "Đăng xuất tài khoản"}
            </button>
          </nav>
          <section className={styles.card} aria-label="Hỗ trợ">
            <p className={styles.greeting}>Cần hỗ trợ?</p>
            <p className={styles.muted}>Hotline 1900 2727, từ 8:30 đến 22:00 mỗi ngày.</p>
          </section>
        </aside>
        <div className={styles.main}>
          <nav className={`${styles.card} ${styles.tabs}`} aria-label="Tab tài khoản">
            {NAV.map((item) => (
              <Link
                key={item.key}
                href={item.href}
                aria-current={item.key === active ? "page" : undefined}
              >
                {item.tab}
              </Link>
            ))}
          </nav>
          {children}
        </div>
      </div>
    </div>
  );
}
