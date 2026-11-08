"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { AdminShellB } from "@/components/admin-b/admin-shell";
import { PageHeader } from "@/components/admin-b/page-header";
import { CardSkeleton, TableSkeleton } from "@/components/admin-b/skeleton";
import { Num, StatusBadge } from "@/components/admin-b/status-badge";
import { getImport, type ImportDetail } from "@/lib/admin-stock-client";
import { formatDateTime } from "@/lib/admin-format";
const STATUS: Record<string, string> = { COMPLETED: "Hoàn tất", DRAFT: "Draft", CANCELLED: "Đã hủy" };
export default function ImportDetailPage() {
  const params = useParams<{ id: string }>(); const id = params?.id ?? ""; const [r, setR] = useState<ImportDetail | null>(null); const [error, setError] = useState(""); const [loading, setLoading] = useState(true);
  useEffect(() => { const c = new AbortController(); getImport(id, c.signal).then(setR).catch((e) => { if (!c.signal.aborted) setError(e instanceof Error ? e.message : "Không tải được phiếu nhập."); }).finally(() => { if (!c.signal.aborted) setLoading(false); }); return () => c.abort(); }, [id]);
  return <AdminShellB active="imports" title="Chi tiết phiếu nhập">
    <Link className="back-link" href="/quan-tri/phieu-nhap">← Phiếu nhập</Link>
    <PageHeader title={r?.receiptCode ?? "Chi tiết phiếu nhập"} hint="Phiếu đã hoàn tất và cộng tồn kho ngay khi tạo." actions={r ? <>{r.status === "COMPLETED" && r.items.length > 0 ? <Link className="secondary" href={`/quan-tri/in-tem?items=${r.items.map((i) => `${i.skuId}:${i.quantity}`).join(",")}&from=${encodeURIComponent(r.receiptCode)}`}>In tem</Link> : null}<StatusBadge status={r.status} label={STATUS[r.status] ?? r.status} /></> : null} />
    {loading ? <><div className="kpi-row st-kpis"><CardSkeleton height={84} /><CardSkeleton height={84} /><CardSkeleton height={84} /></div><TableSkeleton rows={4} columns={6} /></> : null}
    {error ? <div className="order-empty" role="alert"><strong>Không tải được phiếu</strong><p>{error}</p><Link className="secondary" href="/quan-tri/phieu-nhap">Về danh sách</Link></div> : null}
    {r ? <>
      <p className="meta st-sub">{r.supplierName} · {formatDateTime(r.createdAt)}{r.note ? ` · Ghi chú: ${r.note}` : ""}</p>
      <div className="kpi-row st-kpis kpi-row-3">
        <div className="kpi-card kpi-blue"><span className="kpi-label">Số dòng</span><span className="kpi-value"><Num tone="blue" value={r.totalItems} /></span></div>
        <div className="kpi-card kpi-blue"><span className="kpi-label">Số lượng</span><span className="kpi-value"><Num tone="blue" value={r.totalQuantity} /></span></div>
        <div className="kpi-card kpi-green"><span className="kpi-label">Tổng tiền</span><span className="kpi-value"><Num tone="green" bold money value={r.totalAmount} /></span></div>
      </div>
      {r.items.length === 0 ? <div className="order-empty"><strong>Chưa có dòng hàng chi tiết</strong><p>Phiếu ghi nhận {r.totalQuantity} sản phẩm nhưng máy chủ không trả về dòng hàng.</p></div> : null}
      {r.items.length > 0 ? <div className="table-scroll sticky-head review-table-scroll table-cards" tabIndex={0} aria-label="Dòng hàng phiếu nhập"><table className="review-orders-table l3-table"><caption className="sr-only">Các dòng hàng trong phiếu</caption><thead><tr><th>SKU</th><th>Sản phẩm</th><th className="num">SL</th><th className="num">Giá nhập</th><th className="num">Thành tiền</th></tr></thead><tbody>{r.items.map((i) => <tr key={i.id}>
        <td data-label="SKU" className="tabnum">{i.skuId}</td>
        <td data-label="Sản phẩm" className="cell-title"><span className="st-name">{i.productName}</span><small className="meta">{[i.color, i.size].filter(Boolean).join(" · ") || "Chưa có màu/cỡ"}{i.barcode ? ` · ${i.barcode}` : ""}</small></td>
        <td data-label="SL" className="num"><Num tone="blue" value={i.quantity} /></td>
        <td data-label="Giá nhập" className="num"><Num tone="ink" money value={i.importPrice} /></td>
        <td data-label="Thành tiền" className="num"><Num tone="green" bold money value={i.subTotal} /></td>
      </tr>)}</tbody></table></div> : null}
    </> : null}
  </AdminShellB>;
}
