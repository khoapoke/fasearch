import type { Metadata } from "next";
import { OrdersClient } from "@/components/admin-b/orders";

export const metadata: Metadata = { title: "Đơn hàng | FaSearch Admin" };

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams?: Promise<{ status?: string; keyword?: string; orderCode?: string; customerPhone?: string; page?: string; from?: string; to?: string }>;
}) {
  const params = (await searchParams) ?? {};
  const one = (value: string | undefined) => typeof value === "string" ? value : "";
  const page = Number(one(params.page));
  // Old deep links used orderCode/customerPhone; the single search box covers both.
  const initialQuery = one(params.keyword) || one(params.orderCode) || one(params.customerPhone);
  const day = (value: string | undefined) => /^\d{4}-\d{2}-\d{2}$/.test(one(value)) ? one(value) : "";
  return (
    <OrdersClient
      initialQuery={initialQuery}
      initialStatus={one(params.status)}
      initialFrom={day(params.from)}
      initialTo={day(params.to)}
      initialPage={Number.isFinite(page) && page > 0 ? Math.trunc(page) : 0}
    />
  );
}
