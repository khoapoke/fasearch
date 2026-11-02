"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Icon, type UiIcon } from "@/components/ui/icon";
// Khung tài khoản dùng token .acctPage trong auth.css; import tại shell để mọi
// route dùng shell (yêu thích, lịch sử, voucher...) đều có style dù vào trực tiếp.
import "@/components/customer-auth/auth.css";
import { StorefrontShell } from "./storefront-shell";
import {
  AuthApiError,
  authLogout,
  authMe,
  type AuthIdentity,
} from "@/lib/customer-auth-client";

const NAV: Array<{ href: string; label: string; icon: UiIcon }> = [
  { href: "/don-hang", label: "Đơn hàng", icon: "bag" },
  { href: "/yeu-thich", label: "Sản phẩm yêu thích", icon: "heart" },
  { href: "/lich-su-ai", label: "Lịch sử tìm kiếm AI", icon: "camera" },
  { href: "/voucher", label: "Voucher & ưu đãi", icon: "ticket" },
  { href: "/tai-khoan/diem-thuong", label: "Điểm thưởng & hạng", icon: "spark" },
  { href: "/tai-khoan/thong-tin", label: "Thông tin cá nhân", icon: "user" },
  { href: "/tai-khoan/bao-mat", label: "Bảo mật", icon: "shield" },
];

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function AccountCenterShell({
  active,
  kicker,
  title,
  children,
  allowGuest = false,
}: {
  active: string;
  kicker?: string;
  title: string;
  children: React.ReactNode;
  /** Trang công khai (ví dụ danh sách ưu đãi) vẫn xem được khi chưa đăng nhập. */
  allowGuest?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [profile, setProfile] = useState<AuthIdentity | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "signedout">("loading");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let live = true;
    // Candidate JWT identity gate: the same /me the login flow uses. The legacy
    // FASEARCH_SESSION profile call redirects even for a valid candidate login.
    authMe()
      .then((result) => {
        if (!live) return;
        setProfile(result);
        setState("ready");
      })
      .catch((error) => {
        if (!live) return;
        setState("signedout");
        if (!allowGuest && error instanceof AuthApiError && error.status === 401) {
          router.replace(`/dang-nhap?next=${encodeURIComponent(pathname)}`);
        }
      });
    return () => {
      live = false;
    };
  }, [router, pathname, allowGuest]);

  const displayName = profile?.username || "Tài khoản";

  return (
    <StorefrontShell active="/tai-khoan" themed palette="customer" header="customer" footer="none">
      {/* Dùng đúng khung tài khoản đã duyệt (.acctPage) để nội dung con
          (hồ sơ, yêu thích, lịch sử, voucher) nhận token/lưới chuẩn. */}
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
            {kicker ? <p className="hmKicker">{kicker}</p> : null}
            <h1>{title}</h1>
          </div>
          <div className="acct-layout">
            <aside className="acct-nav-wrap" aria-label="Tài khoản của tôi">
              {state === "ready" && profile ? (
                <div className="acct-identity">
                  <strong>{displayName}</strong>
                  {/* Seed accounts use the username as display name; avoid printing it twice. */}
                  {profile.username && profile.username !== displayName ? <span>{profile.username}</span> : null}
                </div>
              ) : (
                <p className="acct-note">{state === "loading" ? "Đang tải…" : "Chưa đăng nhập"}</p>
              )}
              <nav className="acct-nav" aria-label="Quản lý tài khoản">
              {NAV.map((item) => (
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
                <Link className="acct-logout" href={`/dang-nhap?next=${encodeURIComponent(pathname)}`}>
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
