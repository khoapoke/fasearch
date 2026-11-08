import type { Metadata } from "next";
import { AdminProductsClient } from "./products-client";

export const metadata: Metadata = { title: "Sản phẩm | FaSearch Admin" };

export default async function AdminProductsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = (await searchParams) ?? {};
  const one = (value: string | string[] | undefined) => (typeof value === "string" ? value : "");
  const page = Number(one(params.page));
  return (
    <AdminProductsClient
      initialKeyword={one(params.keyword)}
      initialCategoryId={one(params.categoryId)}
      initialStatus={one(params.status)}
      initialPage={Number.isFinite(page) && page > 0 ? Math.trunc(page) : 0}
    />
  );
}
