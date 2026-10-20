"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Icon, type UiIcon } from "@/components/ui/icon";
import { readOwnIdentity, type AccountIdentity } from "@/components/account/account-session";
import { fetchWarehouses } from "@/lib/commerce-client";
import "./merchant.css";

export type MerchantNavKey =
  | "dashboard" | "categories" | "stock" | "reports" | "orders" | "vouchers" | "products" | "customers"
  | "inventory" | "docs" | "transfer" | "count" | "alerts" | "locations";

const NAV: Array<{ key: MerchantNavKey; href: string; label: string; icon: UiIcon; count?: string }> = [
  { key: "dashboard", href: "/kenh-ban", label: "Dashboard", icon: "grid" },
  { key: "categories", href: "/quan-tri/danh-muc", label: "Danh mục sản phẩm", icon: "tag" },
  { key: "products", href: "/quan-tri/san-pham", label: "Sản phẩm", icon: "box" },
  { key: "customers", href: "/quan-tri/khach-hang", label: "Khách hàng", icon: "user" },
  { key: "stock", href: "/kenh-ban/nhap-kho", label: "Nhập kho", icon: "box" },
  { key: "reports", href: "/kenh-ban/bao-cao", label: "Báo cáo thống kê", icon: "chart" },
  { key: "orders", href: "/kenh-ban/don-hang", label: "Đơn hàng", icon: "bag" },
  { key: "vouchers", href: "/kenh-ban/voucher", label: "Voucher", icon: "ticket" },
];

const WH_NAV: Array<{ key: MerchantNavKey; href: string; label: string; icon: UiIcon }> = [
  { key: "inventory", href: "/kenh-ban/ton-kho", label: "Tồn kho", icon: "box" },
  { key: "docs", href: "/kenh-ban/chung-tu", label: "Chứng từ kho", icon: "receipt" },
  { key: "transfer", href: "/kenh-ban/chuyen-kho", label: "Chuyển kho", icon: "truck" },
  { key: "count", href: "/kenh-ban/kiem-ke", label: "Kiểm kê", icon: "history" },
  { key: "alerts", href: "/kenh-ban/canh-bao", label: "Cảnh báo tồn", icon: "bell" },
  { key: "locations", href: "/kenh-ban/kho", label: "Kho & Ngưỡng", icon: "pin" },
];

export function MerchantShell({
  active,
  previewNote,
  topActions,
  children,
}: {
  active: MerchantNavKey;
  previewNote?: string;
  topActions?: React.ReactNode;
  children: React.ReactNode;
}) {
  const [me, setMe] = useState<AccountIdentity | null>(null);
  const [warehouse, setWarehouse] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    readOwnIdentity()
      .then((identity) => {
        if (live) setMe(identity);
      })
      .catch(() => {});
    // Tên kho lấy từ máy chủ, không ghi cứng trong vỏ giao diện.
    fetchWarehouses()
      .then((list) => {
        if (live) setWarehouse((list.find((w) => w.laMacDinh) ?? list[0])?.tenKho ?? null);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);
  return (
    <div>
      <div className="mpBanner">
        <div>
          <Icon name="spark" size={14} />
          <span>Kênh bán{warehouse ? ` · ${warehouse}` : ""} — danh mục và sản phẩm đồng bộ từ máy chủ</span>
          <Link href="/kenh-ban">Về dashboard</Link>
        </div>
      </div>
      <div className="mpFrame">
        <aside className="mpSide" aria-label="Kênh bán">
          <Link className="mpBrand" href="/kenh-ban">
            <span className="mpBrandMark" aria-hidden="true">
              <Icon name="hanger" size={22} />
            </span>
            <span>
              <b>FashionSearch AI</b>
              <small>Kênh bán</small>
            </span>
          </Link>
          <Link className="mpCta" href="/quan-tri/san-pham">
            <Icon name="plus" size={17} /> Tạo sản phẩm mới
          </Link>
          <nav className="mpNav" aria-label="Quản lý bán hàng">
            {NAV.map((item) => (
              <Link
                key={item.key}
                href={item.href}
                aria-current={active === item.key ? "page" : undefined}
              >
                <Icon name={item.icon} size={19} />
                {item.label}
                {item.count ? <span className="cnt">{item.count}</span> : null}
              </Link>
            ))}
          </nav>
          <p className="mpSection">KHO HÀNG (STAFF/ADMIN)</p>
          <nav className="mpNav" aria-label="Quản lý kho">
            {WH_NAV.map((item) => (
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
          <p className="mpSection">HỆ THỐNG</p>
          <nav className="mpNav" aria-label="Hệ thống">
            <Link href="/tai-khoan">
              <Icon name="gear" size={19} /> Cài đặt cửa hàng
            </Link>
          </nav>
          <div className="mpFoot">
            <p className="mpNode">
              <span style={{ width: 9, height: 9, borderRadius: "50%", background: "#10b981", display: "inline-block" }} />
              Merchant Portal <b>kênh bán</b>
            </p>
            <div className="mpUser">
              <span className="mpUserAvatar" aria-hidden="true">
                {me ? me.username.slice(0, 2).toUpperCase() : "KT"}
              </span>
              <div>
                <b>{me ? me.username : "Kênh bán"}</b>
                <small>{me ? me.email : "merchant@fashionsearch.ai"}</small>
              </div>
            </div>
          </div>
        </aside>
        <div className="mpMain">
          <div className="mpTopbar">
            <form className="mpSearch" role="search" action="/nam" method="get">
              <Icon name="search" size={18} />
              <input name="q" placeholder="Tìm nhanh tên áo quần…" aria-label="Tìm nhanh" />
            </form>
            <Link className="mpTopBtn" href="/kenh-ban/nhap-kho">
              <Icon name="box" size={17} /> {warehouse ?? "Kho phục vụ"}
            </Link>
            {topActions}
          </div>
          {previewNote ? (
            <p className="mpPreviewBar" role="note">
              <Icon name="spark" size={15} />
              <span>{previewNote}</span>
            </p>
          ) : null}
          {children}
        </div>
      </div>
    </div>
  );
}
