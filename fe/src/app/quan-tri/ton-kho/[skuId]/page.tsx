"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { AdminShellB } from "@/components/admin-b/admin-shell";
import { CardSkeleton } from "@/components/admin-b/skeleton";
import { Num, StockBadge } from "@/components/admin-b/status-badge";
import { PageHeader } from "@/components/admin-b/page-header";
import { getStock, type Stock } from "@/lib/admin-stock-client";
import { availableTone } from "../stock-client";

export default function StockDetailPage() {
  const params = useParams<{ skuId: string }>();
  const id = params?.skuId ?? "";
  const [s, setS] = useState<Stock | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const c = new AbortController();
    getStock(id, c.signal).then(setS).catch((e) => { if (!c.signal.aborted) setError(e instanceof Error ? e.message : "Không tải được SKU."); }).finally(() => { if (!c.signal.aborted) setLoading(false); });
    return () => c.abort();
  }, [id]);
  const variant = s ? [s.color, s.size].filter(Boolean).join(" · ") : "";
  return <AdminShellB active="stock" title="Chi tiết tồn kho">
    <Link className="back-link" href="/quan-tri/ton-kho">← Tồn kho</Link>
    <PageHeader
      title={s ? s.productName : "Chi tiết tồn kho"}
      hint="Ngưỡng cảnh báo chỉ đọc. Chưa có thông tin kho hoặc vị trí."
      actions={s ? <Link className="primary" href={`/quan-tri/phieu-nhap/moi?sku=${s.skuId}`}>Tạo phiếu nhập</Link> : null}
    />
    {loading ? <CardSkeleton height={120} /> : null}
    {error ? <div className="order-empty" role="alert"><strong>Không tải được SKU</strong><p>{error}</p><Link className="secondary" href="/quan-tri/ton-kho">Về danh sách</Link></div> : null}
    {s ? <>
      <p className="meta st-sub">SKU <span className="tabnum">{s.skuId}</span> · {variant || "Chưa có màu/cỡ"} · {s.barcode ?? "Chưa có Barcode"} · <StockBadge available={s.availableStock} threshold={s.minThreshold} /></p>
      <div className="kpi-row st-kpis">
        <div className="kpi-card"><span className="kpi-label">Tồn vật lý</span><span className="kpi-value"><Num tone="ink" dimZero={false} value={s.physicalStock} /></span></div>
        <div className="kpi-card kpi-violet"><span className="kpi-label">Tạm giữ</span><span className="kpi-value"><Num tone="violet" value={s.reservedStock} /></span></div>
        <div className="kpi-card"><span className="kpi-label">Khả dụng</span><span className="kpi-value"><Num tone={availableTone(s.availableStock, s.minThreshold)} dimZero={false} bold value={s.availableStock} /></span></div>
        <div className="kpi-card"><span className="kpi-label">Ngưỡng tối thiểu</span><span className="kpi-value"><Num tone="gray" dimZero={false} value={s.minThreshold} /></span></div>
      </div>
    </> : null}
  </AdminShellB>;
}
