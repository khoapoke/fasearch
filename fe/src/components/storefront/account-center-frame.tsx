"use client";

// Persistent frame for /tai-khoan routes (mounted once by app/tai-khoan/layout.tsx).
// Sidebar, header and identity survive client navigation between child routes —
// no full reload/flash, no identity re-fetch (shared cache). Pages under
// /tai-khoan render only their body; title/crumb/active come from the pathname
// map below, which mirrors each page's metadata title.

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/ui/icon";
import "@/components/customer-auth/auth.css";
import { StorefrontShell } from "./storefront-shell";
import { ACCOUNT_NAV } from "./account-center-shell";
import { AuthApiError, authLogout, type AuthIdentity } from "@/lib/customer-auth-client";
import { getAccountIdentity, invalidateAccountIdentity } from "@/lib/account-identity-cache";

const TITLES: Record<string, string> = {
  "/tai-khoan": "Tài khoản của tôi",
  "/tai-khoan/thong-tin": "Thông tin cá nhân",
  "/tai-khoan/diem-thuong": "Điểm thưởng & hạng",
  "/tai-khoan/bao-mat": "Bảo mật tài khoản",
  "/tai-khoan/dia-chi": "Địa chỉ nhận hàng",
};

function titleFor(pathname: string): string {
  if (TITLES[pathname]) return TITLES[pathname];
  const prefix = Object.keys(TITLES)
    .filter((key) => key !== "/tai-khoan" && pathname.startsWith(`${key}/`))
    .sort((a, b) => b.length - a.length)[0];
  return prefix ? TITLES[prefix] : "Tài khoản của tôi";
}

export function AccountCenterFrame({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  // Latest-pathname ref: the mount-once identity effect below reads it only
  // when a 401 redirect is needed, so child navigations never re-fetch.
  const pathnameRef = useRef(pathname);
  useEffect(() => {
    pathnameRef.current = pathname;
  }, [pathname]);
  const [profile, setProfile] = useState<AuthIdentity | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "signedout">("loading");
  const [busy, setBusy] = useState(false);

  // Fetch once per frame lifetime; child-route changes reuse the shared cache.
  useEffect(() => {
    let live = true;
    getAccountIdentity()
      .then((result) => {
        if (!live) return;
        setProfile(result);
        setState("ready");
      })
      .catch((error) => {
        if (!live) return;
        setState("signedout");
        if (error instanceof AuthApiError && error.status === 401) {
          router.replace(`/dang-nhap?next=${encodeURIComponent(pathnameRef.current || "/tai-khoan")}`);
        }
      });
    const onAuthChange = () => invalidateAccountIdentity();
    window.addEventListener("fasearch-auth-change", onAuthChange);
    return () => {
      live = false;
      window.removeEventListener("fasearch-auth-change", onAuthChange);
    };
    // Intentionally mount-once: child navigations must not re-fetch identity.
  }, [router]);

  const active = pathname || "/tai-khoan";
  const title = titleFor(active);
  const displayName = profile?.username || "Tài khoản";

  return (
    <StorefrontShell active="/tai-khoan" themed palette="customer" header="customer" footer="none">
      <div className="acctPage">
        <div className="acct-content">
          <nav className="sfCrumbs" aria-label="Đường dẫn">
            <Link href="/">Trang chủ</Link>
            <span aria-hidden="true">›</span>
            <Link href="/tai-khoan">Tài khoản của tôi</Link>
            <span aria-hidden="true">›</span>
            <span aria-current="page">{title}</span>
          </nav>
          <div className="acct-head">
            <h1>{title}</h1>
          </div>
          <div className="acct-layout">
            <aside className="acct-nav-wrap" aria-label="Tài khoản của tôi">
              {state === "ready" && profile ? (
                <div className="acct-identity">
                  <strong>{displayName}</strong>
                  {profile.username && profile.username !== displayName ? <span>{profile.username}</span> : null}
                </div>
              ) : (
                <p className="acct-note">{state === "loading" ? "Đang tải…" : "Chưa đăng nhập"}</p>
              )}
              <nav className="acct-nav" aria-label="Quản lý tài khoản">
                {ACCOUNT_NAV.map((item) => (
                  <Link key={item.href} href={item.href} aria-current={active === item.href ? "page" : undefined}>
                    <Icon name={item.icon} size={18} />
                    <span style={{ flex: 1 }}>{item.label}</span>
                  </Link>
                ))}
              </nav>
              {state === "ready" ? (
                <button
                  className="acct-logout"
                  type="button"
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true);
                    try {
                      await authLogout();
                      invalidateAccountIdentity();
                      router.replace("/dang-nhap");
                      router.refresh();
                    } catch {
                      setBusy(false);
                    }
                  }}
                >
                  <Icon name="logout" size={18} />
                  {busy ? "Đang đăng xuất…" : "Đăng xuất tài khoản"}
                </button>
              ) : (
                <Link className="acct-logout" href={`/dang-nhap?next=${encodeURIComponent(active)}`}>
                  Đăng nhập để dùng ưu đãi của bạn
                </Link>
              )}
            </aside>
            <div className="acct-main">{children}</div>
          </div>
        </div>
      </div>
    </StorefrontShell>
  );
}
