"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AdminShellB } from "./admin-shell";

type Item = { skuId: number; productName: string; color: string | null; size: string | null; quantity: number; unitPrice: number; totalPrice: number };
type Detail = { orderId: number; orderCode: string; status: string; customer: { customerId: number; fullName: string | null; phoneNumber: string | null } | null; deliveryAddress: string | null; note: string | null; items: Item[]; subTotal: number; discountAmount: number; shippingFee: number; totalAmount: number; createdAt: string };
const STATUS: Record<string, string> = { PENDING: "Mới tạo", CONFIRMED: "Đã xác nhận", PACKING: "Đang đóng gói", SHIPPING: "Đang giao", COMPLETED: "Hoàn thành", CANCELLED: "Đã hủy", RETURNED: "Đã trả lại" };
const money = (v: number) => <span className="money">{v.toLocaleString("vi-VN")}<span className="unit">VND</span></span>;
export function OrderDetailClient({ id }: { id: string }) {
  const [order, setOrder] = useState<Detail | null>(null); const [error, setError] = useState(""); const [loading, setLoading] = useState(true);
  useEffect(() => { const c = new AbortController(); fetch(`/api/admin/orders/${id}`, { cache: "no-store", signal: c.signal }).then(async (r) => { const j = await r.json(); if (!r.ok || !j.success) throw new Error(j.message || "Không tải được đơn."); return j.result as Detail; }).then(setOrder).catch((e) => { if (!c.signal.aborted) setError(e instanceof Error ? e.message : "Không tải được đơn."); }).finally(() => { if (!c.signal.aborted) setLoading(false); }); return () => c.abort(); }, [id]);
  const back = typeof window !== "undefined" ? sessionStorage.getItem("admin-orders-return") || "/quan-tri/don-hang" : "/quan-tri/don-hang";
  return <AdminShellB active="orders" title="Chi tiết đơn" eyebrow="Vận hành · chỉ đọc">
    <div className="page-heading"><div><h1>Chi tiết đơn</h1><p className="meta">Dữ liệu BE candidate · không có thao tác ghi</p></div><Link className="text-link" href={back}>← Về danh sách</Link></div>
    {loading ? <p className="meta" role="status">Đang tải đơn…</p> : null}
    {error ? <div className="order-empty" role="alert"><strong>Không tải được đơn</strong><p>{error}</p><Link className="text-link" href="/quan-tri/don-hang">Về danh sách</Link></div> : null}
    {order ? <><div className="section-head"><div><h2>{order.orderCode}</h2><p className="meta">{new Date(order.createdAt).toLocaleString("vi-VN")} · {STATUS[order.status] ?? order.status}</p></div><strong>{money(order.totalAmount)}</strong></div>
      <div className="table-scroll" tabIndex={0} aria-label="Dòng hàng của đơn"><table className="review-orders-table"><caption>Dòng hàng thật; kênh bán và phương thức thanh toán không có trong DTO nên hiển thị là không có dữ liệu.</caption><thead><tr><th>SKU</th><th>Sản phẩm</th><th>Màu / cỡ</th><th className="num">SL</th><th className="num">Đơn giá</th><th className="num">Tổng dòng</th></tr></thead><tbody>{order.items.map((i) => <tr key={i.skuId}><td>{i.skuId}</td><td>{i.productName}</td><td>{[i.color, i.size].filter(Boolean).join(" · ") || "—"}</td><td className="num">{i.quantity}</td><td className="num">{money(i.unitPrice)}</td><td className="num">{money(i.totalPrice)}</td></tr>)}</tbody></table></div>
      <div className="desk-grid" style={{ marginTop: 20 }}><section className="workbench"><h2>Người nhận</h2><p className="meta">{order.customer?.fullName ?? "Không có tên"} · {order.customer?.phoneNumber ?? "Không có SĐT"}</p><p>{order.deliveryAddress ?? "Không có địa chỉ"}</p>{order.note ? <p className="meta">Ghi chú: {order.note}</p> : null}<p className="meta">Kênh bán: không có trong DTO · Phương thức thanh toán: không có trong DTO · Không suy đoán COD/POS.</p></section><aside className="finance-desk"><h2>Tổng đơn</h2><div className="comparison"><span>Tạm tính</span><b>{money(order.subTotal)}</b></div><div className="comparison"><span>Giảm giá</span><b>{money(order.discountAmount)}</b></div><div className="comparison"><span>Phí giao hàng</span><b>{money(order.shippingFee)}</b></div><div className="revenue" style={{ fontSize: 24 }}>{money(order.totalAmount)}</div></aside></div></> : null}
  </AdminShellB>;
}
