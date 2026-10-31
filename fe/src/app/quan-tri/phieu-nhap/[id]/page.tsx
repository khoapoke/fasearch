"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { AdminShellB } from "@/components/admin-b/admin-shell";
import { getImport, money, type ImportDetail } from "@/lib/admin-stock-client";
const STATUS: Record<string, string> = { COMPLETED: "Hoàn tất", DRAFT: "Nháp", CANCELLED: "Đã hủy" };
export default function ImportDetailPage() {
  const params = useParams<{ id: string }>(); const id = params?.id ?? ""; const [r, setR] = useState<ImportDetail | null>(null); const [error, setError] = useState(""); const [loading, setLoading] = useState(true);
  useEffect(() => { const c = new AbortController(); getImport(id, c.signal).then(setR).catch((e) => { if (!c.signal.aborted) setError(e instanceof Error ? e.message : "Không tải được phiếu nhập."); }).finally(() => { if (!c.signal.aborted) setLoading(false); }); return () => c.abort(); }, [id]);
  return <AdminShellB active="imports" title="Chi tiết phiếu nhập" eyebrow="Vận hành · phiếu hoàn tất cập nhật kho"><div className="page-heading"><div><h1>{r?.receiptCode ?? "Chi tiết phiếu nhập"}</h1><p className="meta">Dữ liệu thật từ BE · không có sửa/xóa/approve</p></div><Link className="text-link" href="/quan-tri/phieu-nhap">← Danh sách</Link></div>
    {loading ? <p className="meta" role="status">Đang tải phiếu…</p> : null}{error ? <div className="order-empty" role="alert"><strong>Không tải được phiếu</strong><p>{error}</p><Link className="text-link" href="/quan-tri/phieu-nhap">Về danh sách</Link></div> : null}
    {r ? <><section className="workbench"><div className="section-head"><div><h2>{r.supplierName}</h2><p className="meta">{new Date(r.createdAt).toLocaleString("vi-VN")} · {STATUS[r.status] ?? r.status} · {r.totalItems} dòng · {r.totalQuantity} sản phẩm</p></div><strong>{money(r.totalAmount)}</strong></div>{r.note ? <p className="meta">Ghi chú: {r.note}</p> : null}<div className="table-scroll review-table-scroll" tabIndex={0}><table className="review-orders-table"><caption>Dòng hàng thật; thao tác tạo phiếu đã cập nhật tồn kho, không có bước duyệt riêng.</caption><thead><tr><th>SKU</th><th>Sản phẩm</th><th>Màu / cỡ</th><th>Barcode</th><th className="num">SL</th><th className="num">Giá nhập</th><th className="num">Thành tiền</th></tr></thead><tbody>{r.items.map((i) => <tr key={i.id}><td>{i.skuId}</td><td>{i.productName}</td><td>{[i.color, i.size].filter(Boolean).join(" · ") || "—"}</td><td>{i.barcode ?? "—"}</td><td className="num">{i.quantity}</td><td className="num">{money(i.importPrice)}</td><td className="num">{money(i.subTotal)}</td></tr>)}</tbody></table></div><p className="meta">Không có warehouse trong DTO; không hiển thị kho giả. Không có nút hủy/sửa/xóa phiếu.</p></section></> : null}
  </AdminShellB>;
}
