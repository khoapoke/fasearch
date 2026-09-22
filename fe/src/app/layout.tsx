import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "FaSearch — Tìm thời trang bằng hình ảnh",
  description: "Tìm sản phẩm thời trang tương đồng từ một ảnh truy vấn.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="vi">
      <body>{children}</body>
    </html>
  );
}
