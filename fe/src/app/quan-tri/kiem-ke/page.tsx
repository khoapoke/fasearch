"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { AdminShellB } from "@/components/admin-b/admin-shell";
import { useAdminRole, canManage } from "@/components/admin-b/use-admin-role";
import { getStocktakePage, statusLabel, type Page, type StocktakeSummary } from "@/lib/admin-stocktake-client";
const STATUS = [["", "Tất cả"], ["PENDING_APPROVAL", "Chờ duyệt"], ["RECONCILED", "Đã đối soát"], ["CANCELLED", "Đã hủy"]];
export default function StocktakeListPage() {
  const role = useAdminRole();
  const [data, setData] = useState<Page<StocktakeSummary> | null>(null);
  const [page, setPage] = useState(0);
  const [code, setCode] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  async function load(next = page, clear = false) {
    setLoading(true); setError("");
    const q = new URLSearchParams({ page: String(next), size: "10" });
    if (!clear && code.trim()) q.set("stocktakeCode", code.trim());
    if (!clear && status) q.set("status", status);
    try { setData(await getStocktakePage(q.toString())); } catch (e) { setError(e instanceof Error ? e.message : "Không tải được phiếu kiểm kê."); } finally { setLoading(false); }
  }
  // Initial load only; filters apply on submit.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { void Promise.resolve().then(() => load(0)); }, []);
  const canWrite = canManage(role);
  return <AdminShellB active="stocktakes" title="Kiểm kê" eyebrow="Vận hành · ghi nhận số đếm, không tự điều chỉnh tồn">
    <div className="page-heading"><div><h1>Kiểm kê</h1><p className="meta">Phiếu chỉ ghi nhận · PENDING_APPROVAL · không có duyệt/áp dụng tồn · {canWrite ? "Quản trị viên và Quản lý có thể tạo" : "đang kiểm tra quyền"}</p></div>{canWrite ? <Link className="primary" href="/quan-tri/kiem-ke/moi">Tạo phiếu kiểm kê</Link> : null}</div>
    <form className="stock-filters" onSubmit={(e) => { e.preventDefault(); setPage(0); void load(0); }}>
      <div className="catalog-field"><label htmlFor="st-code">Mã phiếu</label><input id="st-code" className="catalog-input" value={code} onChange={(e) => setCode(e.target.value)} /></div>
      <div className="catalog-field"><label htmlFor="st-status">Trạng thái</label><select id="st-status" className="catalog-input" value={status} onChange={(e) => setStatus(e.target.value)}>{STATUS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>
      <button className="primary" type="submit">Lọc</button><button className="text-link" type="button" onClick={() => { setCode(""); setStatus(""); setPage(0); void load(0, true); }}>Đặt lại</button>
    </form>
    {loading ? <p className="meta" role="status">Đang tải phiếu kiểm kê…</p> : null}
    {error ? <div className="order-empty" role="alert"><strong>Không tải được phiếu kiểm kê</strong><p>{error}</p><button className="text-link" type="button" onClick={() => load(page)}>Thử lại (giữ lọc)</button></div> : null}
    {!loading && !error && data?.content.length === 0 ? <div className="order-empty"><strong>Chưa có phiếu kiểm kê</strong><p>Ghi nhận số đếm thực tế để tạo phiếu chờ duyệt.</p></div> : null}
    {data && data.content.length > 0 ? <div className="table-scroll review-table-scroll" tabIndex={0} aria-label="Danh sách phiếu kiểm kê"><table className="review-orders-table"><caption>{data.totalElements} phiếu · trang {data.pageNumber + 1}/{Math.max(1, data.totalPages)} · dữ liệu BE candidate · ghi nhận, không áp dụng tồn</caption><thead><tr><th>Mã phiếu</th><th>Trạng thái</th><th>Ngày tạo</th><th className="num">Dòng</th><th className="num">Σ|lệch|</th></tr></thead><tbody>{data.content.map((r) => <tr key={r.stocktakeId}><td><Link className="text-link" href={`/quan-tri/kiem-ke/${r.stocktakeId}`}>{r.stocktakeCode}</Link></td><td>{statusLabel(r.status)}</td><td>{new Date(r.createdAt).toLocaleString("vi-VN")}</td><td className="num">{r.totalItems}</td><td className="num">{r.totalDiscrepancy}</td></tr>)}</tbody></table></div> : null}
    {data && data.totalPages > 1 ? <div className="review-summary"><button className="text-link" disabled={page === 0} onClick={() => { setPage(page - 1); void load(page - 1); }}>← Trước</button><span>Trang {page + 1} · {data.totalElements}</span><button className="text-link" disabled={data.last} onClick={() => { setPage(page + 1); void load(page + 1); }}>Sau →</button></div> : null}
    <p className="meta" style={{ marginTop: 16 }}>Không có API duyệt/áp dụng/hủy trong candidate. Tồn kho không thay đổi khi ghi nhận kiểm kê.</p>
  </AdminShellB>;
}
