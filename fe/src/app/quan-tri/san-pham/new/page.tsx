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
  const [categories, setCategories] = useState<Category[]>([]); const [error, setError] = useState("");
  useEffect(() => { const c = new AbortController(); getCategories(c.signal).then(setCategories).catch((e) => setError(e instanceof Error ? e.message : "Không tải được danh mục.")); return () => c.abort(); }, []);
  return <AdminShellB active="products" title="Tạo sản phẩm" eyebrow="Vận hành · ADMIN"><div className="page-heading"><div><h1>Tạo sản phẩm</h1><p className="meta">Metadata thật từ BE · SKU thêm ở trang chi tiết sau khi tạo</p></div><Link className="text-link" href="/quan-tri/san-pham">← Danh sách</Link></div>{error ? <p className="catalog-error" role="alert">{error}</p> : null}{role === "ADMIN" ? (categories.length ? <><UrlAssist /><ProductForm mode="create" categories={categories} /></> : <p className="meta">Đang tải danh mục…</p>) : role ? <div className="order-empty"><strong>Chỉ ADMIN được tạo sản phẩm</strong><p>Tài khoản STAFF chỉ đọc catalog; biểu mẫu ghi không được hiển thị.</p><Link className="text-link" href="/quan-tri/san-pham">Về danh sách</Link></div> : <p className="meta" role="status">Đang kiểm tra quyền…</p>}</AdminShellB>;
}
