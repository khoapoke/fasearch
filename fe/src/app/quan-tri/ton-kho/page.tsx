import type { Metadata } from "next";
import { StockListClient } from "./stock-client";

export const metadata: Metadata = { title: "Tồn kho | FaSearch Admin" };

export default async function StockListPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = (await searchParams) ?? {};
  const one = (value: string | string[] | undefined) => (typeof value === "string" ? value : "");
  const page = Number(one(params.page));
  return (
    <StockListClient
      initialKeyword={one(params.keyword)}
      initialPage={Number.isFinite(page) && page > 0 ? Math.trunc(page) : 0}
    />
  );
}
