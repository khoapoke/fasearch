"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { AdminShellB } from "@/components/admin-b/admin-shell";
import { useAdminRole, canManage } from "@/components/admin-b/use-admin-role";
import { ProductForm } from "@/components/admin-b/product-form";
import { getCategories, getProduct, type Category, type Product } from "@/lib/admin-catalog-client";
export default function EditProductPage() {
  const params = useParams<{ id: string }>(); const id = params?.id ?? ""; const role = useAdminRole();
  const [product, setProduct] = useState<Product | null>(null); const [categories, setCategories] = useState<Category[]>([]); const [error, setError] = useState(""); const [loading, setLoading] = useState(true); const [retry, setRetry] = useState(0);
  useEffect(() => { const c = new AbortController(); setLoading(true); setError(""); Promise.all([getProduct(id, c.signal), getCategories(c.signal)]).then(([p, cs]) => { if (!c.signal.aborted) { setProduct(p); setCategories(cs); } }).catch((e) => { if (!c.signal.aborted) setError(e instanceof Error ? e.message : "Không tải được sản phẩm."); }).finally(() => { if (!c.signal.aborted) setLoading(false); }); return () => c.abort(); }, [id, retry]);
  return <AdminShellB active="products" title="Sửa sản phẩm" eyebrow="Vận hành"><div className="page-heading"><div><h1>Sửa sản phẩm</h1><p className="meta">Thay đổi được lưu vào bản nháp; nội dung đang bán giữ nguyên đến khi xuất bản</p></div><Link className="text-link" href={`/quan-tri/san-pham/${id}`}>← Chi tiết</Link></div>{error ? <div className="catalog-error" role="alert"><p>{error}</p><button className="text-link" type="button" onClick={() => setRetry((n) => n + 1)}>Thử lại</button></div> : null}{canManage(role) ? (product && categories.length ? <ProductForm mode="edit" product={product} categories={categories} /> : loading ? <p className="meta" role="status">Đang tải…</p> : !error ? <div className="order-empty"><strong>Chưa có danh mục</strong><p>Cần có danh mục để sửa bản nháp.</p><Link className="text-link" href="/quan-tri/danh-muc">Mở danh mục</Link></div> : null) : role ? <div className="order-empty"><strong>Chỉ Quản trị viên hoặc Quản lý được sửa sản phẩm</strong><p>Tài khoản hiện tại chỉ đọc; biểu mẫu metadata không được hiển thị.</p><Link className="text-link" href={`/quan-tri/san-pham/${id}`}>Về chi tiết</Link></div> : <p className="meta" role="status">Đang kiểm tra quyền…</p>}</AdminShellB>;
}
