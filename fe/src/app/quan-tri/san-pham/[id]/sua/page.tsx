"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { AdminShellB } from "@/components/admin-b/admin-shell";
import { ProductForm } from "@/components/admin-b/product-form";
import { getCategories, getProduct, type Category, type Product } from "@/lib/admin-catalog-client";
export default function EditProductPage() {
  const params = useParams<{ id: string }>(); const id = params?.id ?? "";
  const [product, setProduct] = useState<Product | null>(null); const [categories, setCategories] = useState<Category[]>([]); const [error, setError] = useState("");
  useEffect(() => { const c = new AbortController(); Promise.all([getProduct(id, c.signal), getCategories(c.signal)]).then(([p, cs]) => { setProduct(p); setCategories(cs); }).catch((e) => { if (!c.signal.aborted) setError(e instanceof Error ? e.message : "Không tải được sản phẩm."); }); return () => c.abort(); }, [id]);
  return <AdminShellB active="products" title="Sửa sản phẩm" eyebrow="Vận hành · ADMIN"><div className="page-heading"><div><h1>Sửa sản phẩm</h1><p className="meta">Metadata PATCH không gửi variants; ID/barcode SKU giữ nguyên</p></div><Link className="text-link" href={`/quan-tri/san-pham/${id}`}>← Chi tiết</Link></div>{error ? <p className="catalog-error" role="alert">{error}</p> : null}{product && categories.length ? <ProductForm mode="edit" product={product} categories={categories} /> : !error ? <p className="meta">Đang tải…</p> : null}</AdminShellB>;
}
