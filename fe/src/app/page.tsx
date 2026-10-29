import { StorefrontShell } from "@/components/storefront/storefront-shell";
import { HomeSections } from "./home-sections";

export const metadata = {
  title: "FashionSearch AI — Thời Trang Công Nghệ & Tinh Giản Tiên Phong",
  description: "Tìm mọi outfit bằng AI. Thời trang công nghệ mới, tinh giản tiên phong.",
};

export default function HomePage() {
  return (
    <StorefrontShell active="/" themed>
      <HomeSections />
    </StorefrontShell>
  );
}
