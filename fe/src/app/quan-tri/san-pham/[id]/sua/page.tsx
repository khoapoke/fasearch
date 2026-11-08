"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { AdminShellB } from "@/components/admin-b/admin-shell";
import { useAdminRole, useAdminCan } from "@/components/admin-b/use-admin-role";
import { PageHeader } from "@/components/admin-b/page-header";
import { CardSkeleton } from "@/components/admin-b/skeleton";
import { ProductForm } from "@/components/admin-b/product-form";
import { getCategories, getProduct, type Category, type Product } from "@/lib/admin-catalog-client";
export default function EditProductPage() {
  const params = useParams<{ id: string }>(); const id = params?.id ?? ""; const role = useAdminRole(); const can = useAdminCan();
  const [retry, setRetry] = useState(0);
  // The result is tagged with the request it answers, so loading/error reset by derivation when id or retry change.
  const key = `${id}:${retry}`;
  const [result, setResult] = useState<{ key: string; product: Product | null; categories: Category[]; error: string } | null>(null);
  const current = result?.key === key ? result : null;
  const product = current?.product ?? null; const categories = current?.categories ?? []; const error = current?.error ?? ""; const loading = current === null;
  useEffect(() => { const c = new AbortController(); Promise.all([getProduct(id, c.signal), getCategories(c.signal)]).then(([p, cs]) => { if (!c.signal.aborted) setResult({ key, product: p, categories: cs, error: "" }); }).catch((e) => { if (!c.signal.aborted) setResult({ key, product: null, categories: [], error: e instanceof Error ? e.message : "Không tải được sản phẩm." }); }); return () => c.abort(); }, [id, key]);
  return <AdminShellB active="products" title="Sửa sản phẩm" eyebrow="Vận hành"><Link className="back-link" href={`/quan-tri/san-pham/${id}`}>← Về chi tiết sản phẩm</Link><PageHeader title="Sửa sản phẩm" />{error ? <div className="catalog-error" role="alert"><p>{error}</p><button className="secondary" type="button" onClick={() => setRetry((n) => n + 1)}>Thử lại</button></div> : null}{can("PRODUCT_EDIT") ? (product && categories.length ? <ProductForm mode="edit" product={product} categories={categories} /> : loading ? <div className="form-layout"><div className="form-main"><CardSkeleton height={180} /><CardSkeleton height={120} /><CardSkeleton height={200} /></div><div className="form-side"><CardSkeleton height={360} /></div></div> : !error ? <div className="order-empty"><strong>Chưa có danh mục</strong><p>Cần có danh mục để sửa Draft.</p><Link className="secondary" href="/quan-tri/danh-muc">Mở danh mục</Link></div> : null) : role ? <div className="order-empty"><strong>Chỉ Quản trị viên hoặc Quản lý được sửa sản phẩm</strong><p>Tài khoản hiện tại chỉ đọc.</p><Link className="secondary" href={`/quan-tri/san-pham/${id}`}>Về chi tiết</Link></div> : <p className="meta" role="status">Đang kiểm tra quyền…</p>}</AdminShellB>;
}
