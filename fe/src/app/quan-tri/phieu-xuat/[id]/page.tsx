"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { AdminShellB } from "@/components/admin-b/admin-shell";
import { getExport, type ExportDetail } from "@/lib/admin-export-client";
const TYPE: Record<string, string> = { DAMAGED: "Hàng hỏng", OTHER: "Khác" };
const STATUS: Record<string, string> = { COMPLETED: "Hoàn tất", DRAFT: "Nháp", CANCELLED: "Đã hủy" };
export default function ExportDetailPage() {
  const params = useParams<{ id: string }>(); const id = params?.id ?? ""; const [r, setR] = useState<ExportDetail | null>(null); const [error, setError] = useState(""); const [loading, setLoading] = useState(true);
  useEffect(() => { const c = new AbortController(); getExport(id, c.signal).then(setR).catch((e) => { if (!c.signal.aborted) setError(e instanceof Error ? e.message : "Không tải được phiếu xuất."); }).finally(() => { if (!c.signal.aborted) setLoading(false); }); return () => c.abort(); }, [id]);
  return <AdminShellB active="exports" title="Chi tiết phiếu xuất" eyebrow="Vận hành · chỉ đọc"><div className="page-heading"><div><h1>{r?.receiptCode ?? "Chi tiết phiếu xuất"}</h1><p className="meta">Dữ liệu thật từ BE · không có sửa/xóa/duyệt</p></div><Link className="text-link" href="/quan-tri/phieu-xuat">← Danh sách</Link></div>
    {loading ? <p className="meta" role="status">Đang tải phiếu…</p> : null}{error ? <div className="order-empty" role="alert"><strong>Không tải được phiếu xuất</strong><p>{error}</p><Link className="text-link" href="/quan-tri/phieu-xuat">Về danh sách</Link></div> : null}
    {r ? <section className="workbench"><div className="section-head"><div><h2>{TYPE[r.exportType] ?? r.exportType}</h2><p className="meta">{new Date(r.createdAt).toLocaleString("vi-VN")} · {STATUS[r.status] ?? r.status} · {r.totalItems} dòng · {r.totalQuantity} sản phẩm</p></div></div>{r.note ? <p className="meta">Ghi chú: {r.note}</p> : null}<div className="table-scroll review-table-scroll" tabIndex={0} aria-label="Dòng hàng phiếu xuất"><table className="review-orders-table"><caption>Dòng xuất thật; không có totalAmount/valuation trong DTO nên không hiển thị cột tiền.</caption><thead><tr><th>SKU</th><th>Sản phẩm</th><th>Màu / cỡ</th><th>Barcode</th><th className="num">SL</th><th>Lý do</th></tr></thead><tbody>{r.items.map((i) => <tr key={i.id}><td>{i.skuId}</td><td>{i.productName}</td><td>{[i.color, i.size].filter(Boolean).join(" · ") || "—"}</td><td>{i.barcode ?? "—"}</td><td className="num">{i.quantity}</td><td>{i.reason ?? "—"}</td></tr>)}</tbody></table></div><p className="meta">Không có kho/vị trí trong DTO; không có nút hủy/sửa/xóa/duyệt. Phiếu COMPLETED đã trừ kho ngay.</p></section> : null}
  </AdminShellB>;
}
