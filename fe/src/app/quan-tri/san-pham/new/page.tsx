"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { AdminShellB } from "@/components/admin-b/admin-shell";
import { ProductForm } from "@/components/admin-b/product-form";
import { getCategories, type Category } from "@/lib/admin-catalog-client";
export default function NewProductPage() {
  const [categories, setCategories] = useState<Category[]>([]); const [error, setError] = useState("");
  useEffect(() => { const c = new AbortController(); getCategories(c.signal).then(setCategories).catch((e) => setError(e instanceof Error ? e.message : "Không tải được danh mục.")); return () => c.abort(); }, []);
  return <AdminShellB active="products" title="Tạo sản phẩm" eyebrow="Vận hành · ADMIN"><div className="page-heading"><div><h1>Tạo sản phẩm</h1><p className="meta">Metadata thật từ BE · SKU thêm ở trang chi tiết sau khi tạo</p></div><Link className="text-link" href="/quan-tri/san-pham">← Danh sách</Link></div>{error ? <p className="catalog-error" role="alert">{error}</p> : null}{categories.length ? <ProductForm mode="create" categories={categories} /> : <p className="meta">Đang tải danh mục…</p>}</AdminShellB>;
}
