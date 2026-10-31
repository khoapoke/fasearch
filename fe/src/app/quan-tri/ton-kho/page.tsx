"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { AdminShellB } from "@/components/admin-b/admin-shell";
import { getStockPage, stockValue, type Page, type Stock } from "@/lib/admin-stock-client";
export default function StockListPage() {
  const [rows, setRows] = useState<Page<Stock> | null>(null); const [page, setPage] = useState(0);
  const [sku, setSku] = useState(""); const [productName, setProductName] = useState(""); const [keyword, setKeyword] = useState("");
  const [loading, setLoading] = useState(true); const [error, setError] = useState("");
  async function load(next = page) {
    setLoading(true); setError(""); const q = new URLSearchParams({ page: String(next), size: "10" });
    if (sku.trim()) q.set("sku", sku.trim()); if (productName.trim()) q.set("productName", productName.trim()); if (keyword.trim()) q.set("keyword", keyword.trim());
    try { setRows(await getStockPage(q.toString())); } catch (e) { setError(e instanceof Error ? e.message : "Không tải được tồn kho."); } finally { setLoading(false); }
  }
  useEffect(() => { void Promise.resolve().then(() => load(0)); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);
  return <AdminShellB active="stock" title="Tồn kho" eyebrow="Vận hành · dữ liệu tồn kho thật, cấp SKU">
    <div className="page-heading"><div><h1>Tồn kho</h1><p className="meta">Cấp SKU · không có chiều kho trong DTO · ADMIN/STAFF đọc</p></div></div>
    <form className="stock-filters" onSubmit={(e) => { e.preventDefault(); setPage(0); void load(0); }}><div className="catalog-field"><label htmlFor="st-sku">SKU / barcode</label><input id="st-sku" className="catalog-input" value={sku} onChange={(e) => setSku(e.target.value)} /></div><div className="catalog-field"><label htmlFor="st-name">Tên sản phẩm</label><input id="st-name" className="catalog-input" value={productName} onChange={(e) => setProductName(e.target.value)} /></div><div className="catalog-field"><label htmlFor="st-keyword">Từ khóa</label><input id="st-keyword" className="catalog-input" value={keyword} onChange={(e) => setKeyword(e.target.value)} /></div><button className="primary" type="submit">Lọc</button><button className="text-link" type="button" onClick={() => { setSku(""); setProductName(""); setKeyword(""); setPage(0); void load(0); }}>Đặt lại</button></form>
    {loading ? <p className="meta" role="status">Đang tải tồn kho…</p> : null}{error ? <div className="order-empty" role="alert"><strong>Không tải được tồn kho</strong><p>{error}</p><button className="text-link" type="button" onClick={() => load(page)}>Thử lại (giữ lọc)</button></div> : null}
    {!loading && !error && rows?.content.length === 0 ? <div className="order-empty"><strong>Không có SKU khớp</strong><p>Thử bỏ lọc hoặc từ khóa khác.</p></div> : null}
    {rows && rows.content.length > 0 ? <div className="table-scroll review-table-scroll" tabIndex={0} aria-label="Danh sách tồn kho theo SKU"><table className="review-orders-table"><caption>{rows.totalElements} SKU · trang {rows.pageNumber + 1}/{Math.max(1, rows.totalPages)} · physical / reserved / available là số thật từ BE</caption><thead><tr><th>SKU</th><th>Sản phẩm</th><th>Màu / cỡ</th><th>Barcode</th><th className="num">Vật lý</th><th className="num">Tạm giữ</th><th className="num">Khả dụng</th><th className="num">Ngưỡng</th></tr></thead><tbody>{rows.content.map((s) => <tr key={s.skuId}><td><Link className="text-link" href={`/quan-tri/ton-kho/${s.skuId}`}>{s.skuId}</Link></td><td>{s.productName}<small>SP {s.productId}</small></td><td>{[s.color, s.size].filter(Boolean).join(" · ") || "—"}</td><td>{s.barcode ?? "—"}</td><td className="num">{stockValue(s.physicalStock)}</td><td className="num">{stockValue(s.reservedStock)}</td><td className="num"><strong>{stockValue(s.availableStock)}</strong></td><td className="num">{stockValue(s.minThreshold)}</td></tr>)}</tbody></table></div> : null}
    {rows && rows.totalPages > 1 ? <div className="review-summary"><button className="text-link" disabled={page === 0} onClick={() => { setPage(page - 1); void load(page - 1); }}>← Trước</button><span>Trang {page + 1} · {rows.totalElements}</span><button className="text-link" disabled={rows.last} onClick={() => { setPage(page + 1); void load(page + 1); }}>Sau →</button></div> : null}
    <p className="meta" style={{ marginTop: 16 }}>Không hiển thị kho/vị trí vì DTO không có trường này. Không có chỉnh ngưỡng, điều chỉnh tay, xuất kho hay kiểm kê.</p>
  </AdminShellB>;
}
