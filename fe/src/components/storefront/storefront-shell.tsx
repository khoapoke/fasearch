"use client";

import Link from "next/link";
import { useState } from "react";
import { Icon } from "@/components/ui/icon";
import { CartCount, HeaderAccount } from "./storefront-client";
import "./storefront.css";

function NewsletterForm() {
  const [msg, setMsg] = useState("");
  return (
    <form
      className="sfNewsForm"
      aria-label="Đăng ký nhận tin"
      onSubmit={(e) => {
        e.preventDefault();
        setMsg("Đã ghi nhận email trên trình duyệt này. Đăng ký nhận tin qua website chưa mở — theo dõi ưu đãi ở trang Voucher.");
      }}
    >
      <input type="email" required placeholder="Nhập email của bạn…" aria-label="Email" />
      <button className="sfBtn" type="submit">Đăng Ký</button>
      {msg ? (
        <p className="mpMuted" role="status" style={{ flexBasis: "100%", fontSize: 12.5 }}>{msg}</p>
      ) : null}
    </form>
  );
}

const NAV = [
  { href: "/hang-moi", label: "Hàng Mới" },
  { href: "/nam", label: "Nam" },
  { href: "/nu", label: "Nữ" },
  { href: "/bo-suu-tap", label: "Bộ Sưu Tập" },
  { href: "/lich-su-ai", label: "Tìm Bằng AI", ai: true },
  { href: "/tim-kiem-ai", label: "Tìm Chữ AI", ai: true },
  { href: "/sale", label: "Sale Giảm Sốc" },
];

export function StorefrontShell({
  active,
  previewNote,
  children,
}: {
  active?: string;
  previewNote?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="sfPromo">
        <div className="sfPromoInner">
          <p className="sfPromoMsgs">
            <span>Miễn phí vận chuyển đơn từ 200K</span>
            <span>Đổi trả 7 ngày tận nơi</span>
            <span>Bảo hành trọn đời cúc chỉ</span>
          </p>
          <p className="sfPromoHotline">Hotline: 1900 6868</p>
        </div>
      </div>
      <header className="sfHeader">
        <div className="sfBar">
          <Link className="sfBrand" href="/" aria-label="FashionSearch AI — trang chủ">
            <span className="sfBrandMark" aria-hidden="true">FS</span>
            <span>
              FashionSearch <span className="sfBrandAi">AI</span>
              <small>FASHION DRIVEN INTELLIGENCE</small>
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
            <Link className="sfIconBtn" href="/lich-su-ai" aria-label="Tìm bằng ảnh">
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
      <main className="sfMain">{children}</main>
      <footer className="sfFooter">
        <div className="sfNews">
          <div>
            <h2>Đăng ký nhận thông tin &amp; ưu đãi mới</h2>
            <p>BST mới và mẹo phối đồ mỗi tuần. Voucher xem ở trang ưu đãi (bản xem trước).</p>
          </div>
          <NewsletterForm />
        </div>
        <div className="sfCols">
          <div>
            <h3>
              <span className="sfBrand" style={{ fontSize: 15 }}>
                <span className="sfBrandMark" aria-hidden="true">FS</span>
                FashionSearch <span className="sfBrandAi">AI</span>
              </span>
            </h3>
            <p>Trải nghiệm mua sắm thời trang nam công nghệ cao: tìm đúng đồ, mặc chuẩn size, giao nhanh 24h.</p>
          </div>
          <nav aria-label="Chính sách khách hàng">
            <h3>Chính sách khách hàng</h3>
            <Link href="/don-hang">Kiểm tra đơn hàng</Link>
            <Link href="/thanh-toan">Hướng dẫn thanh toán</Link>
            <Link href="/don-hang">Chính sách đổi trả 7 ngày</Link>
            <Link href="/voucher">Ưu đãi &amp; voucher (xem trước)</Link>
          </nav>
          <nav aria-label="Hỗ trợ">
            <h3>Hỗ trợ &amp; hướng dẫn</h3>
            <Link href="/lich-su-ai">Hướng dẫn tìm bằng ảnh</Link>
            <Link href="/tai-khoan/dia-chi">Sổ địa chỉ nhận hàng</Link>
            <Link href="/tai-khoan">Câu hỏi thường gặp</Link>
          </nav>
          <div>
            <h3>Về chúng tôi</h3>
            <Link href="/bo-suu-tap">Về FashionSearch AI</Link>
            <Link href="/bo-suu-tap">Bộ sưu tập</Link>
            <p className="sfHotline">1900 6868 (8:30 – 22:00)</p>
            <p>cskh@fashionsearch.ai</p>
          </div>
        </div>
        <div className="sfBottom">
          <p>© 2024 FashionSearch AI. Inspired by minimal utility &amp; modern tech.</p>
          <p>Điều khoản dịch vụ · Quyền riêng tư · Sitemap</p>
        </div>
      </footer>
    </div>
  );
}
