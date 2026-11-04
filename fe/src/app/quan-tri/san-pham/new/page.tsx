"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { AdminShellB } from "@/components/admin-b/admin-shell";
import { ProductForm } from "@/components/admin-b/product-form";
import { UrlAssist } from "@/components/admin/url-assist";
import { getCategories, type Category } from "@/lib/admin-catalog-client";
import { useAdminRole } from "@/components/admin-b/use-admin-role";
export default function NewProductPage() {
  const role = useAdminRole();
  const [categories, setCategories] = useState<Category[]>([]); const [error, setError] = useState(""); const [loading, setLoading] = useState(true); const [retry, setRetry] = useState(0);
  useEffect(() => { const c = new AbortController(); setLoading(true); setError(""); getCategories(c.signal).then((rows) => { if (!c.signal.aborted) setCategories(rows); }).catch((e) => { if (!c.signal.aborted) setError(e instanceof Error ? e.message : "Không tải được danh mục."); }).finally(() => { if (!c.signal.aborted) setLoading(false); }); return () => c.abort(); }, [retry]);
  return <AdminShellB active="products" title="Tạo sản phẩm" eyebrow="Vận hành · ADMIN"><div className="page-heading"><div><h1>Tạo sản phẩm</h1><p className="meta">Lưu metadata vào bản nháp; bổ sung ảnh và biến thể trước khi xuất bản</p></div><Link className="text-link" href="/quan-tri/san-pham">← Danh sách</Link></div>{error ? <div className="catalog-error" role="alert"><p>{error}</p><button className="text-link" type="button" onClick={() => setRetry((n) => n + 1)}>Thử lại</button></div> : null}{role === "ADMIN" ? (categories.length ? <><UrlAssist /><ProductForm mode="create" categories={categories} /></> : loading ? <p className="meta" role="status">Đang tải danh mục…</p> : !error ? <div className="order-empty"><strong>Chưa có danh mục</strong><p>Cần tạo danh mục trước khi lập bản nháp sản phẩm.</p><Link className="text-link" href="/quan-tri/danh-muc">Mở danh mục</Link></div> : null) : role ? <div className="order-empty"><strong>Chỉ ADMIN được tạo sản phẩm</strong><p>Tài khoản STAFF chỉ đọc catalog; biểu mẫu ghi không được hiển thị.</p><Link className="text-link" href="/quan-tri/san-pham">Về danh sách</Link></div> : <p className="meta" role="status">Đang kiểm tra quyền…</p>}</AdminShellB>;
}
