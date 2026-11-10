"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Icon, type UiIcon } from "@/components/ui/icon";
import { authMe } from "@/lib/customer-auth-client";
import { readOwnIdentity, type AccountIdentity } from "@/components/account/account-session";
import "./admin.css";

export type AdminNavKey = "campaigns" | "loyalty" | "reports" | "audit";

const NAV: Array<{ key: AdminNavKey; href: string; label: string; icon: UiIcon }> = [
  { key: "campaigns", href: "/quan-tri/khuyen-mai", label: "Khuyến mãi & Voucher", icon: "ticket" },
  { key: "loyalty", href: "/quan-tri/chinh-sach-diem", label: "Chính sách điểm", icon: "spark" },
  { key: "reports", href: "/quan-tri/bao-cao", label: "Report", icon: "chart" },
  { key: "audit", href: "/quan-tri/nhat-ky", label: "Nhật ký hệ thống", icon: "receipt" },
];

export function AdminShell({
  active,
  crumbs,
  title,
  tag,
  lede,
  actions,
  previewNote,
  children,
}: {
  active?: AdminNavKey;
  crumbs: Array<{ href?: string; label: string }>;
  title: string;
  tag?: string;
  lede?: string;
  actions?: React.ReactNode;
  previewNote?: string;
  children: React.ReactNode;
}) {
  const [me, setMe] = useState<AccountIdentity | null>(null);
  useEffect(() => {
    let live = true;
    authMe()
      .then((identity) => {
        if (!live) return;
        if (identity.role === "ADMIN" || identity.role === "STAFF") {
          setMe({ id: identity.id, username: identity.username, email: identity.email, role: identity.role, authenticated: true });
        }
      })
      .catch(() => {
        void readOwnIdentity()
          .then((identity) => { if (live) setMe(identity); })
          .catch(() => {});
      });
    return () => {
      live = false;
    };
  }, []);
  return (
    <div className="adFrame">
      <aside className="adSide" aria-label="Admin console">
        <Link className="adBrand" href="/quan-tri">
          <span className="adBrandMark" aria-hidden="true">
            <Icon name="grid" size={20} />
          </span>
          <span>
            <b>FashionSearch AI</b>
            <small>Quản trị</small>
          </span>
        </Link>
        <nav className="adNav" aria-label="Quản trị hệ thống">
          {NAV.map((item) => (
            <Link
              key={item.key}
              href={item.href}
              aria-current={active === item.key ? "page" : undefined}
            >
              <Icon name={item.icon} size={19} />
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="adFoot">
          <p className="adSys">Phân quyền: ADMIN · STAFF · CUSTOMER</p>
          <div className="adUser">
            <span className="adUserAvatar" aria-hidden="true">
              {me ? me.username.slice(0, 2).toUpperCase() : "?"}
            </span>
            <div>
              <b>{me ? me.username : "Chưa đăng nhập"}</b>
              <small>{me ? me.email : "Phiên không hợp lệ"}</small>
            </div>
          </div>
        </div>
      </aside>
      <div className="adMain">
        <nav className="adCrumbs" aria-label="Đường dẫn">
          {crumbs.map((c, i) => (
            <span key={c.label} style={{ display: "contents" }}>
              {i > 0 ? <span aria-hidden="true">/</span> : null}
              {c.href ? <Link href={c.href}>{c.label}</Link> : <span aria-current="page">{c.label}</span>}
            </span>
          ))}
        </nav>
        <div className="adTitleRow">
          <h1 className="adTitle">{title}</h1>
          {tag ? <span className="adTag">{tag}</span> : null}
          {actions ? <div className="adActions">{actions}</div> : null}
        </div>
        {lede ? <p className="adLede">{lede}</p> : null}
        {previewNote ? <p className="adPreviewBar" role="note">{previewNote}</p> : null}
        {children}
      </div>
    </div>
  );
}
