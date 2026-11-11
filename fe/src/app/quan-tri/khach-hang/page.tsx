import type { Metadata } from "next";
import { AdminCustomersClient } from "./customers-client";

export const metadata: Metadata = { title: "Khách hàng | FaSearch Admin" };

export default async function AdminCustomersPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = (await searchParams) ?? {};
  const one = (value: string | string[] | undefined) => (typeof value === "string" ? value : "");
  const page = Number(one(params.page));
  return (
    <AdminCustomersClient
      initialKeyword={one(params.keyword)}
      initialPage={Number.isFinite(page) && page > 0 ? Math.trunc(page) : 0}
    />
  );
}
