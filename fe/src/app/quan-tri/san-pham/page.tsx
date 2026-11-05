"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { AdminShellB } from "@/components/admin-b/admin-shell";
import { ProductImage } from "@/components/admin-b/product-image";
import { useAdminRole, canManage } from "@/components/admin-b/use-admin-role";
import { getCategories, getProductPage, type Category, type ProductPage } from "@/lib/admin-catalog-client";
const STATUS = ["", "DRAFT", "ACTIVE", "OUT_OF_STOCK", "DISCONTINUED"];
const STATUS_LABEL: Record<string, string> = { DRAFT: "Nháp", ACTIVE: "Đang bán", OUT_OF_STOCK: "Tạm hết hàng", DISCONTINUED: "Ngừng kinh doanh" };
export default function AdminProductsPage() {
  const role = useAdminRole();
  const [categories, setCategories] = useState<Category[]>([]);
  const [page, setPage] = useState(0); const [keyword, setKeyword] = useState(""); const [categoryId, setCategoryId] = useState(""); const [status, setStatus] = useState("");
  const [data, setData] = useState<ProductPage | null>(null); const [loading, setLoading] = useState(true); const [error, setError] = useState("");
  const req = useRef(0);
  useEffect(() => { const c = new AbortController(); getCategories(c.signal).then(setCategories).catch(() => setCategories([])); return () => c.abort(); }, []);
  async function load(nextPage = page, clear = false) {
    const my = ++req.current; setLoading(true); setError("");
    const q = new URLSearchParams({ page: String(nextPage), size: "10" });
    if (!clear && keyword.trim()) q.set("keyword", keyword.trim()); if (!clear && categoryId) q.set("categoryId", categoryId); if (!clear && status) q.set("status", status);
    try { const result = await getProductPage(q.toString()); if (req.current === my) setData(result); }
    catch (e) { if (req.current === my) setError(e instanceof Error ? e.message : "Không tải được sản phẩm."); }
    finally { if (req.current === my) setLoading(false); }
  }
  // Initial load only; filters apply on submit.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { void Promise.resolve().then(() => load(0)); }, []);
  return <AdminShellB active="products" title="Sản phẩm" eyebrow="Vận hành · catalog thật từ BE">
    <div className="page-heading"><div><h1>Sản phẩm</h1><p className="meta">Danh sách thật · lọc/phân trang server · {canManage(role) ? "Quản trị viên và Quản lý có quyền sửa" : "Tài khoản hiện tại chỉ đọc"}</p></div>{canManage(role) ? <Link className="primary" href="/quan-tri/san-pham/new">Tạo sản phẩm</Link> : null}</div>
    <form className="catalog-toolbar" onSubmit={(e) => { e.preventDefault(); setPage(0); void load(0); }}>
      <div className="catalog-field"><label htmlFor="p-keyword">Từ khóa</label><input id="p-keyword" className="catalog-input" value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="Tên sản phẩm" /></div>
      <div className="catalog-field"><label htmlFor="p-category">Danh mục</label><select id="p-category" className="catalog-input" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}><option value="">Tất cả</option>{categories.map((c) => <option key={c.id} value={c.id}>{c.categoryName}</option>)}</select></div>
      <div className="catalog-field"><label htmlFor="p-status">Trạng thái</label><select id="p-status" className="catalog-input" value={status} onChange={(e) => setStatus(e.target.value)}>{STATUS.map((s) => <option key={s || "all"} value={s}>{s ? STATUS_LABEL[s] : "Tất cả"}</option>)}</select></div>
      <button className="primary" type="submit">Lọc</button><button className="text-link" type="button" onClick={() => { setKeyword(""); setCategoryId(""); setStatus(""); setPage(0); void load(0, true); }}>Đặt lại</button>
    </form>
    {loading ? <p className="meta" role="status">Đang tải sản phẩm…</p> : null}
    {error ? <div className="order-empty" role="alert"><strong>Không tải được sản phẩm</strong><p>{error}</p><button className="text-link" type="button" onClick={() => load(page)}>Thử lại (giữ lọc)</button></div> : null}
    {!loading && !error && data?.content.length === 0 ? <div className="order-empty"><strong>Không có sản phẩm khớp</strong><p>Thử bỏ lọc hoặc từ khóa khác.</p></div> : null}
    {!loading && !error && data && data.content.length > 0 ? <div className="table-scroll review-table-scroll" tabIndex={0} aria-label="Danh sách sản phẩm"><table className="review-orders-table"><caption>{data.totalElements} sản phẩm · trang {data.pageNumber + 1}/{Math.max(1, data.totalPages)} · dữ liệu BE candidate</caption><thead><tr><th>Ảnh</th><th>Tên sản phẩm</th><th>Danh mục</th><th className="num">Giá</th><th>Trạng thái</th></tr></thead><tbody>{data.content.map((p) => <tr key={p.id}><td><ProductImage src={p.imageUrl} alt={p.productName} /></td><td><Link className="text-link" href={`/quan-tri/san-pham/${p.id}`}>{p.productName}</Link><small>#{p.id}{p.material ? ` · ${p.material}` : ""}</small></td><td>{p.categoryName ?? "—"}</td><td className="num">{p.price.toLocaleString("vi-VN")} VND</td><td>{STATUS_LABEL[p.status] ?? p.status}</td></tr>)}</tbody></table></div> : null}
    {data && data.totalPages > 1 ? <div className="review-summary"><button className="text-link" disabled={page === 0} onClick={() => { setPage(page - 1); void load(page - 1); }}>← Trước</button><span>Trang {page + 1} · {data.totalElements}</span><button className="text-link" disabled={data.last} onClick={() => { setPage(page + 1); void load(page + 1); }}>Sau →</button></div> : null}
    <p className="meta" style={{ marginTop: 16 }}>Không có nút xóa. Ảnh chỉ dùng URL từ BE; upload/tồn kho/vị trí chưa có API nên không hiển thị.</p>
  </AdminShellB>;
}
