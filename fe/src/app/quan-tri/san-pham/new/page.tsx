"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { AdminShellB } from "@/components/admin-b/admin-shell";
import { PageHeader } from "@/components/admin-b/page-header";
import { ProductForm } from "@/components/admin-b/product-form";
import { UrlAssist } from "@/components/admin/url-assist";
import { getCategories, type Category } from "@/lib/admin-catalog-client";
import { useAdminRole, useAdminCan } from "@/components/admin-b/use-admin-role";
export default function NewProductPage() {
  const role = useAdminRole(); const can = useAdminCan();
  const [retry, setRetry] = useState(0);
  // The result is tagged with the attempt it answers, so loading/error reset by derivation on retry.
  const [result, setResult] = useState<{ retry: number; categories: Category[]; error: string } | null>(null);
  const current = result?.retry === retry ? result : null;
  const categories = current?.categories ?? []; const error = current?.error ?? ""; const loading = current === null;
  useEffect(() => { const c = new AbortController(); getCategories(c.signal).then((rows) => { if (!c.signal.aborted) setResult({ retry, categories: rows, error: "" }); }).catch((e) => { if (!c.signal.aborted) setResult({ retry, categories: [], error: e instanceof Error ? e.message : "Không tải được danh mục." }); }); return () => c.abort(); }, [retry]);
  return <AdminShellB active="products" title="Tạo sản phẩm"><Link className="back-link" href="/quan-tri/san-pham">← Về danh sách sản phẩm</Link><PageHeader title="Tạo sản phẩm" hint="Sản phẩm được lưu vào Draft. Bổ sung ảnh và biến thể rồi Publish để hiển thị với khách hàng." />{error ? <div className="catalog-error" role="alert"><p>{error}</p><button className="secondary" type="button" onClick={() => setRetry((n) => n + 1)}>Thử lại</button></div> : null}{can("PRODUCT_EDIT") ? (categories.length ? <>{can("PRODUCT_IMPORT") ? <details className="fold url-import"><summary>Nhập từ URL (tùy chọn)</summary><UrlAssist /></details> : null}<ProductForm mode="create" categories={categories} /></> : loading ? <p className="meta" role="status">Đang tải danh mục…</p> : !error ? <div className="order-empty"><strong>Chưa có danh mục</strong><p>Cần tạo danh mục trước khi lập Draft sản phẩm.</p><Link className="secondary" href="/quan-tri/danh-muc">Mở danh mục</Link></div> : null) : role ? <div className="order-empty"><strong>Chỉ Quản trị viên hoặc Quản lý được tạo sản phẩm</strong><p>Tài khoản hiện tại chỉ đọc.</p><Link className="secondary" href="/quan-tri/san-pham">Về danh sách</Link></div> : <p className="meta" role="status">Đang kiểm tra quyền…</p>}</AdminShellB>;
}
