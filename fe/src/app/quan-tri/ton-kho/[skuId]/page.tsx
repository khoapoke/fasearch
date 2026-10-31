"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { AdminShellB } from "@/components/admin-b/admin-shell";
import { getStock, stockValue, type Stock } from "@/lib/admin-stock-client";
export default function StockDetailPage() {
  const params = useParams<{ skuId: string }>(); const id = params?.skuId ?? ""; const [s, setS] = useState<Stock | null>(null); const [error, setError] = useState(""); const [loading, setLoading] = useState(true);
  useEffect(() => { const c = new AbortController(); getStock(id, c.signal).then(setS).catch((e) => { if (!c.signal.aborted) setError(e instanceof Error ? e.message : "Không tải được SKU."); }).finally(() => { if (!c.signal.aborted) setLoading(false); }); return () => c.abort(); }, [id]);
  return <AdminShellB active="stock" title="Chi tiết tồn kho" eyebrow="Vận hành · cấp SKU"><div className="page-heading"><div><h1>Chi tiết tồn kho</h1><p className="meta">Số liệu thật từ BE · không có kho/threshold editor</p></div><Link className="text-link" href="/quan-tri/ton-kho">← Danh sách</Link></div>
    {loading ? <p className="meta" role="status">Đang tải…</p> : null}{error ? <div className="order-empty" role="alert"><strong>Không tải được SKU</strong><p>{error}</p><Link className="text-link" href="/quan-tri/ton-kho">Về danh sách</Link></div> : null}
    {s ? <><section className="workbench"><div className="section-head"><div><h2>{s.productName}</h2><p className="meta">SKU {s.skuId} · SP {s.productId} · {[s.color, s.size].filter(Boolean).join(" · ") || "—"} · {s.barcode ?? "Chưa có barcode"}</p></div><Link className="primary" href={`/quan-tri/phieu-nhap/moi?sku=${s.skuId}`}>Tạo phiếu nhập</Link></div><div className="stock-kpis"><div><span>Tồn vật lý</span><strong>{stockValue(s.physicalStock)}</strong></div><div><span>Tạm giữ</span><strong>{stockValue(s.reservedStock)}</strong></div><div><span>Khả dụng</span><strong>{stockValue(s.availableStock)}</strong></div><div><span>Ngưỡng tối thiểu</span><strong>{stockValue(s.minThreshold)}</strong></div></div><p className="meta">Tồn kho theo SKU; DTO không trả kho/vị trí nên không hiển thị kho giả. Ngưỡng chỉ đọc, không có form sửa.</p></section></> : null}
  </AdminShellB>;
}
