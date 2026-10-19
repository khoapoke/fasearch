"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Icon, type UiIcon } from "@/components/ui/icon";
import { StorefrontShell } from "./storefront-shell";
import {
  logout,
  readOwnProfile,
  type OwnProfile,
} from "@/components/account/account-session";

const NAV: Array<{ href: string; label: string; icon: UiIcon }> = [
  { href: "/tai-khoan", label: "Đơn hàng của tôi", icon: "bag" },
  { href: "/yeu-thich", label: "Sản phẩm yêu thích", icon: "heart" },
  { href: "/lich-su-ai", label: "Lịch sử tìm kiếm AI & Ảnh", icon: "camera" },
  { href: "/tai-khoan/dia-chi", label: "Sổ địa chỉ nhận hàng", icon: "pin" },
  { href: "/voucher", label: "Voucher & Ưu đãi của tôi", icon: "ticket" },
  { href: "/tai-khoan/diem-thuong", label: "Điểm thưởng & Hạng", icon: "spark" },
  { href: "/tai-khoan/thong-tin", label: "Thông tin cá nhân", icon: "user" },
  { href: "/tai-khoan/bao-mat", label: "Cài đặt tài khoản & Bảo mật", icon: "shield" },
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
}: {
  active: string;
  kicker: string;
  title: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [profile, setProfile] = useState<OwnProfile | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "signedout">("loading");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let live = true;
    readOwnProfile()
      .then((result) => {
        if (!live) return;
        if (!result) {
          setState("signedout");
          router.replace(`/dang-nhap?next=${encodeURIComponent(pathname)}`);
          return;
        }
        setProfile(result);
        setState("ready");
      })
      .catch(() => live && setState("signedout"));
    return () => {
      live = false;
    };
  }, [router, pathname]);

  const displayName = profile?.customer?.hoTen || profile?.account.username || "Tài khoản";

  return (
    <StorefrontShell active="/tai-khoan">
      <div className="sfAccountWrap">
        <nav className="sfCrumbs" aria-label="Đường dẫn">
          <Link href="/">Trang chủ</Link>
          <span aria-hidden="true">›</span>
          <Link href="/tai-khoan">Tài khoản của tôi</Link>
          <span aria-hidden="true">›</span>
          <span aria-current="page">{title}</span>
        </nav>
        <p className="hmKicker" style={{ marginBottom: 8 }}>{kicker}</p>
        <h1 className="pgTitle">{title}</h1>
        <nav className="pvTabs" aria-label="Khu vực tài khoản" style={{ marginTop: 12 }}>
          {[
            { href: "/tai-khoan/thong-tin", label: "Thông tin cá nhân" },
            { href: "/don-hang", label: "Đơn hàng của tôi" },
            { href: "/yeu-thich", label: "Sản phẩm yêu thích" },
            { href: "/lich-su-ai", label: "Lịch sử tìm kiếm AI & Ảnh" },
          ].map((t) => (
            <Link key={t.href} href={t.href} aria-current={active === t.href ? "page" : undefined} style={active === t.href ? { background: "var(--accent)", borderColor: "var(--accent)", color: "#fff" } : undefined}>
              {t.label}
            </Link>
          ))}
        </nav>
        <div className="sfAccountGrid" style={{ marginTop: 16 }}>
          <aside aria-label="Tài khoản của tôi">
            <div className="sfSideCard">
              {state === "ready" && profile ? (
                <div className="sfIdentity">
                  <span className="sfIdentityAvatar" aria-hidden="true">{initials(displayName)}</span>
                  <div>
                    <p className="sfIdentityName">{displayName}</p>
                    <p className="sfIdentitySub">{profile.account.username}</p>
                    
                  </div>
                </div>
              ) : (
                <p className="sfIdentitySub">{state === "loading" ? "Đang tải…" : "Chưa đăng nhập"}</p>
              )}
            </div>
            <nav className="sfSideCard sfSideNav" aria-label="Quản lý tài khoản">
              {NAV.map((item) => (
                <Link key={item.href} href={item.href} aria-current={active === item.href ? "page" : undefined}>
                  <Icon name={item.icon} size={18} />
                  <span style={{ flex: 1 }}>{item.label}</span>
                </Link>
              ))}
              <button
                type="button"
                disabled={busy || state !== "ready"}
                onClick={async () => {
                  setBusy(true);
                  try {
                    await logout();
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
            </nav>
            <div className="sfSideCard">
              <p className="sfIdentityName">Cần hỗ trợ đơn hàng?</p>
              <p className="sfIdentitySub">Hotline 1900 6868 (8:30 – 22:00). Zalo OA FashionSearch.</p>
            </div>
          </aside>
          <div>{children}</div>
        </div>
      </div>
    </StorefrontShell>
  );
}
