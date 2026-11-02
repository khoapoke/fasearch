"use client";

import Link from "next/link";
import { Icon } from "@/components/ui/icon";
import { CartCount, HeaderAccount } from "./storefront-client";
import { CustomerHeader } from "./customer-header";
import { ThemeControl } from "@/components/studio/theme-control";
import { CustomerCartProvider } from "@/components/customer-commerce/customer-cart-provider";
import "./customer-palette.css";
import "./storefront.css";

const NAV = [
  { href: "/hang-moi", label: "Hàng mới" },
  { href: "/nam", label: "Nam" },
  { href: "/nu", label: "Nữ" },
  { href: "/bo-suu-tap", label: "Bộ sưu tập" },
  { href: "/tim-kiem-ai", label: "Tìm bằng AI", ai: true },
  { href: "/sale", label: "Sale" },
];

export function StorefrontShell({
  active,
  previewNote,
  themed = false,
  palette,
  header,
  footer = "storefront",
  children,
}: {
  active?: string;
  previewNote?: string;
  /** Bề mặt pilot search-studio: áp theme + control giao diện (P1). */
  themed?: boolean;
  /** Bảng màu Customer đã duyệt (Home/AI); route khác không truyền nên không đổi. */
  palette?: "home" | "customer";
  /** Header Customer đã duyệt (6fdbcee); Home/AI/detail "customer", auth "customer-focused". */
  header?: "customer" | "customer-focused";
  /** Shell footer cũ; mặc định giữ nguyên cho mọi route, catalog mới opt-out. */
  footer?: "storefront" | "none";
  children: React.ReactNode;
}) {
  const rootClass = [themed ? "studio" : "", palette === "home" || palette === "customer" ? "hmPalette" : ""]
    .filter(Boolean)
    .join(" ");
  return (
    <CustomerCartProvider>
    <div className={rootClass || undefined}>
      {header === "customer" || header === "customer-focused" ? (
        <>
          <CustomerHeader active={active} focused={header === "customer-focused"} />
        </>
      ) : (
        <>
      <div className="sfPromo">
        <div className="sfPromoInner">
          <p className="sfPromoMsgs">
            <span>Phí vận chuyển tính ở bước thanh toán</span>
          </p>
          {themed ? <ThemeControl /> : null}
        </div>
      </div>
      <header className="sfHeader">
        <div className="sfBar">
          <Link className="sfBrand" href="/" aria-label="FaSearch — trang chủ">
            <span className="sfBrandMark" aria-hidden="true">FS</span>
            <span>
              FaSearch
            </span>
          </Link>
          <nav className="sfNav" aria-label="Điều hướng chính">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active === item.href ? "page" : undefined}
                className={item.ai ? "sfNavAi" : undefined}
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <form className="sfSearch" role="search" action="/nam" method="get">
            <input name="q" type="search" placeholder="Áo thun nam" aria-label="Tìm sản phẩm" />
            <Link className="sfIconBtn" href="/tim-kiem-ai" aria-label="Tìm bằng ảnh">
              <Icon name="camera" size={19} />
            </Link>
            <button className="sfSearchBtn" type="submit" aria-label="Tìm kiếm">
              <Icon name="search" size={17} />
            </button>
          </form>
          <Link className="sfIconBtn" href="/yeu-thich" aria-label="Sản phẩm yêu thích">
            <Icon name="heart" size={21} />
          </Link>
          <Link className="sfIconBtn" href="/gio-hang" aria-label="Giỏ hàng">
            <Icon name="bag" size={21} />
            <CartCount />
          </Link>
          <HeaderAccount />
        </div>
        <nav className="sfMobileNav" aria-label="Điều hướng chính (di động)">
          {NAV.map((item) => (
            <Link key={item.href} href={item.href}>
              {item.label}
            </Link>
          ))}
        </nav>
      </header>
      {previewNote ? (
        <div className="sfPreviewBar" role="note">
          <div>
            <Icon name="spark" size={15} />
            <span>{previewNote}</span>
          </div>
        </div>
      ) : null}
        </>
      )}
      <main className="sfMain">{children}</main>
      {footer === "storefront" ? (
      <footer className="sfFooter">
        <div className="sfNews">
          <div>
            <h2>Ưu đãi mới</h2>
            <p>Voucher đang mở xem ở trang ưu đãi.</p>
          </div>
          <Link className="sfBtn" href="/voucher">Xem ưu đãi</Link>
        </div>
        <div className="sfCols">
          <div>
            <h3>
              <span className="sfBrand" style={{ fontSize: 15 }}>
                <span className="sfBrandMark" aria-hidden="true">FS</span>
                FaSearch
              </span>
            </h3>
            <p>Danh mục, tồn kho và giá đều lấy từ máy chủ.</p>
          </div>
          <nav aria-label="Chính sách khách hàng">
            <h3>Khách hàng</h3>
            <Link href="/don-hang">Tra cứu đơn hàng</Link>
            <Link href="/voucher">Ưu đãi &amp; voucher</Link>
            <Link href="/tai-khoan">Thông tin &amp; địa chỉ</Link>
          </nav>
          <nav aria-label="Hỗ trợ">
            <h3>Hỗ trợ &amp; hướng dẫn</h3>
            <Link href="/tim-kiem-ai">Tìm kiếm bằng AI</Link>
            <Link href="/lich-su-ai">Lịch sử tìm kiếm AI</Link>
            <Link href="/tai-khoan">Tài khoản của tôi</Link>
          </nav>
          <div>
            <h3>Về chúng tôi</h3>
            <Link href="/bo-suu-tap">Bộ sưu tập</Link>
          </div>
        </div>
        <div className="sfBottom">
          <p>© {new Date().getFullYear()} FaSearch.</p>
          <p>Điều khoản dịch vụ · Quyền riêng tư</p>
        </div>
      </footer>
      ) : null}
    </div>
    </CustomerCartProvider>
  );
}
