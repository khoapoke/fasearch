import Link from "next/link";
import { StorefrontShell } from "@/components/storefront/storefront-shell";
import { StudyClient } from "./study-client";
import "./study.css";
import "@/components/customer-catalog/catalog.css";

export const metadata = { title: "Nghiên cứu catalog A/B | FaSearch" };

/** Entry + A/B views. ?direction=a|b — thiếu thì trang so sánh chọn hướng. */
export default async function StudyPage({ searchParams }: { searchParams: Promise<{ direction?: string }> }) {
  const { direction } = await searchParams;
  return (
    <StorefrontShell active="/nam" themed palette="customer" header="customer" footer="none">
      <div className="stPage">
        <div className="st-toolbar" role="note" aria-label="Phạm vi nghiên cứu">
          <span className="st-toolbartag">Nghiên cứu thiết kế</span>
          <span>
            So sánh A/B độc lập — dùng dữ liệu thật (chỉ đọc), chưa thay bất kỳ trang bán hàng nào.
            {direction === "a" || direction === "b" ? (
              <>
                {" "}Đang xem hướng {direction.toUpperCase()} · <Link href="/catalog-study">Đổi hướng</Link>
              </>
            ) : null}
          </span>
        </div>
        <StudyClient direction={direction === "b" ? "b" : direction === "a" ? "a" : null} />
      </div>
    </StorefrontShell>
  );
}
