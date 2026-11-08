"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { AdminShellB } from "@/components/admin-b/admin-shell";
import { PageHeader } from "@/components/admin-b/page-header";
import { CardSkeleton, TableSkeleton } from "@/components/admin-b/skeleton";
import { getStocktake, statusLabel, type StocktakeDetail } from "@/lib/admin-stocktake-client";
import { Num, StatusBadge } from "@/components/admin-b/status-badge";
import { formatDateTime } from "@/lib/admin-format";
export default function StocktakeDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id ?? "";
  const [r, setR] = useState<StocktakeDetail | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const c = new AbortController();
    getStocktake(id, c.signal).then(setR).catch((e) => { if (!c.signal.aborted) setError(e instanceof Error ? e.message : "Không tải được phiếu kiểm kê."); }).finally(() => { if (!c.signal.aborted) setLoading(false); });
    return () => c.abort();
  }, [id]);
  return <AdminShellB active="stocktakes" title="Chi tiết kiểm kê">
    <Link className="back-link" href="/quan-tri/kiem-ke">← Kiểm kê</Link>
    <PageHeader title={r?.stocktakeCode ?? "Chi tiết kiểm kê"} hint="Số liệu hệ thống là số đã lưu lúc kiểm kê, không phải tồn hiện tại. Lệch = số đếm thực tế − số hệ thống. Phiếu không áp dụng vào tồn kho." actions={r ? <StatusBadge status={r.status} label={statusLabel(r.status)} /> : null} />
    {loading ? <><div className="kpi-row st-kpis"><CardSkeleton height={84} /><CardSkeleton height={84} /><CardSkeleton height={84} /></div><TableSkeleton rows={4} columns={6} /></> : null}
    {error ? <div className="order-empty" role="alert"><strong>Không tải được phiếu kiểm kê</strong><p>{error}</p><Link className="secondary" href="/quan-tri/kiem-ke">Về danh sách</Link></div> : null}
    {r ? <>
      <p className="meta st-sub">{formatDateTime(r.createdAt)} · Ghi chú: {r.note || "Chưa có"}</p>
      <div className="kpi-row st-kpis kpi-row-3">
        <div className="kpi-card kpi-blue"><span className="kpi-label">Số dòng</span><span className="kpi-value"><Num tone="blue" value={r.discrepancies.length} /></span></div>
        <div className="kpi-card kpi-amber"><span className="kpi-label">Tổng lệch (tuyệt đối)</span><span className="kpi-value"><Num tone="amber" bold value={r.totalDiscrepancy} /></span></div>
        <div className="kpi-card"><span className="kpi-label">Dòng lệch</span><span className="kpi-value"><Num tone="red" value={r.discrepancies.filter((i) => i.difference !== 0).length} /></span></div>
      </div>
      <div className="table-scroll sticky-head review-table-scroll table-cards" tabIndex={0} aria-label="Dòng kiểm kê"><table className="review-orders-table l3-table stocktake-detail-table"><caption className="sr-only">Lệch = số đếm thực tế − số hệ thống.</caption><thead><tr><th>SKU</th><th>Sản phẩm</th><th className="num">Hệ thống</th><th className="num">Đếm</th><th className="num">Lệch</th></tr></thead><tbody>{r.discrepancies.map((i) => <tr key={i.id}>
        <td data-label="SKU" className="tabnum">{i.skuId}</td>
        <td data-label="Sản phẩm" className="cell-title"><span className="st-name">{i.productName}</span><small className="meta">{[i.color, i.size].filter(Boolean).join(" · ") || "Chưa có màu/cỡ"}{i.barcode ? ` · ${i.barcode}` : ""}</small></td>
        <td data-label="Hệ thống" className="num"><Num tone="ink" dimZero={false} value={i.systemCount} /></td>
        <td data-label="Đếm" className="num"><Num tone="blue" dimZero={false} value={i.actualCount} /></td>
        <td data-label="Lệch" className="num"><Num tone="delta" signed bold value={i.difference} /></td>
      </tr>)}</tbody></table></div>
    </> : null}
  </AdminShellB>;
}
