"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { AdminShellB } from "@/components/admin-b/admin-shell";
import { getStocktake, signed, statusLabel, type StocktakeDetail } from "@/lib/admin-stocktake-client";
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
  return <AdminShellB active="stocktakes" title="Chi tiết kiểm kê" eyebrow="Vận hành · chỉ đọc · không áp dụng tồn">
    <div className="page-heading"><div><h1>{r?.stocktakeCode ?? "Chi tiết kiểm kê"}</h1><p className="meta">Dữ liệu thật từ BE · snapshot lúc ghi nhận · không có duyệt/áp dụng/hủy</p></div><Link className="text-link" href="/quan-tri/kiem-ke">← Danh sách</Link></div>
    {loading ? <p className="meta" role="status">Đang tải phiếu…</p> : null}
    {error ? <div className="order-empty" role="alert"><strong>Không tải được phiếu kiểm kê</strong><p>{error}</p><Link className="text-link" href="/quan-tri/kiem-ke">Về danh sách</Link></div> : null}
    {r ? <section className="workbench">
      <div className="section-head"><div><h2>{statusLabel(r.status)}</h2><p className="meta">{new Date(r.createdAt).toLocaleString("vi-VN")} · {r.discrepancies.length} dòng · Σ|lệch| = {r.totalDiscrepancy}</p></div></div>
      <p className="stocktake-note prose-cell"><strong>Ghi chú:</strong> {r.note || "—"}</p>
      <div className="table-scroll review-table-scroll" tabIndex={0} aria-label="Dòng kiểm kê"><table className="review-orders-table stocktake-detail-table"><caption>Hệ thống = physicalStock tại lúc BE ghi nhận; lệch = đếm thực tế − hệ thống (có dấu). Σ|lệch| là tổng giá trị tuyệt đối, không phải tổng có dấu.</caption><thead><tr><th>SKU</th><th>Sản phẩm</th><th>Màu / cỡ</th><th>Barcode</th><th className="num">Hệ thống</th><th className="num">Đếm</th><th className="num">Lệch</th></tr></thead><tbody>{r.discrepancies.map((i) => <tr key={i.id}><td>{i.skuId}</td><td>{i.productName}</td><td>{[i.color, i.size].filter(Boolean).join(" · ") || "—"}</td><td>{i.barcode ?? "—"}</td><td className="num">{i.systemCount}</td><td className="num">{i.actualCount}</td><td className={`num stocktake-diff ${i.difference > 0 ? "pos" : i.difference < 0 ? "neg" : ""}`}>{signed(i.difference)}</td></tr>)}</tbody></table></div>
      <p className="meta">Không có trường kho/vị trí hay version/409 trong DTO. Phiếu đang PENDING_APPROVAL; candidate không có API duyệt/áp dụng nên không có nút thay đổi tồn. Snapshot hệ thống ở trên là dữ liệu BE lưu, không phải tồn hiện tại.</p>
    </section> : null}
  </AdminShellB>;
}
