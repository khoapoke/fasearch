import type { Metadata } from "next";
import { Be_Vietnam_Pro } from "next/font/google";
import "./globals.css";

// Source typeface (Stitch export uses Google Fonts Be Vietnam Pro).
// next/font self-hosts it at build time, so a font CDN failure cannot break
// runtime rendering; the CSS stack in globals.css still falls back to system
// fonts when the webfont is unavailable.
const beVietnamPro = Be_Vietnam_Pro({
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
  variable: "--font-be-vietnam-pro",
});

export const metadata: Metadata = {
  title: "FaSearch — Tìm thời trang bằng hình ảnh",
  description: "Tìm sản phẩm thời trang tương đồng từ một ảnh truy vấn.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="vi" className={beVietnamPro.variable}>
      <body>{children}</body>
    </html>
  );
}
