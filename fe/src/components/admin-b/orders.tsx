"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { AdminShellB } from "./admin-shell";
import { Icon } from "./icons";

type Order = { orderId: number; orderCode: string; status: string; customerName: string | null; customerPhone: string | null; deliveryAddress: string | null; subTotal: number; discountAmount: number; shippingFee: number; totalAmount: number; createdAt: string };
type Page = { content: Order[]; pageNumber: number; pageSize: number; totalElements: number; totalPages: number; last: boolean };
const STATUS: Record<string, string> = { PENDING: "Mới tạo", CONFIRMED: "Đã xác nhận", PACKING: "Đang đóng gói", SHIPPING: "Đang giao", COMPLETED: "Hoàn thành", CANCELLED: "Đã hủy", RETURNED: "Đã trả lại" };
const FILTERS = [{ v: "", l: "Tất cả" }, ...Object.entries(STATUS).map(([v, l]) => ({ v, l }))];
function date(v: string) { const d = new Date(v); return Number.isNaN(d.getTime()) ? v : new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short" }).format(d); }
function money(v: number) { return <span className="money">{v.toLocaleString("vi-VN")}<span className="unit">VND</span></span>; }

export function OrdersClient() {
  const [status, setStatus] = useState(""); const [orderCode, setOrderCode] = useState(""); const [phone, setPhone] = useState("");
  const [page, setPage] = useState(0); const [data, setData] = useState<Page | null>(null); const [loading, setLoading] = useState(true); const [error, setError] = useState("");
  const pending = useRef(false);
  useEffect(() => { const s = new URLSearchParams(window.location.search); void Promise.resolve().then(() => { setStatus(s.get("status") ?? ""); setOrderCode(s.get("orderCode") ?? ""); setPhone(s.get("customerPhone") ?? ""); }); }, []);
  const load = async (nextPage = page, nextStatus = status, clear = false) => {
    if (pending.current) return; pending.current = true; setLoading(true); setError("");
    const q = new URLSearchParams({ page: String(nextPage), size: "10", sort: "orderDate,desc" });
    if (!clear && nextStatus) q.set("status", nextStatus); if (!clear && orderCode.trim()) q.set("orderCode", orderCode.trim()); if (!clear && phone.trim()) q.set("customerPhone", phone.trim());
    try { const r = await fetch(`/api/admin/orders?${q}`, { cache: "no-store" }); const j = await r.json(); if (!r.ok || !j.success) throw new Error(j.message || "Không tải được đơn."); setData(j.result as Page); }
    catch (e) { setError(e instanceof Error ? e.message : "Không tải được đơn."); }
    finally { pending.current = false; setLoading(false); }
  };
  // Load follows the status filter; the other fields apply on explicit submit.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { void Promise.resolve().then(() => load(0, status)); }, [status]);
  useEffect(() => { sessionStorage.setItem("admin-orders-return", `/quan-tri/don-hang${window.location.search}`); }, [status, orderCode, phone, page]);
  return <AdminShellB active="orders" title="Đơn hàng" eyebrow="Vận hành · dữ liệu thật từ BE">
    <div className="page-heading"><div><h1>Đơn hàng</h1><p className="meta">Đọc đơn · lọc theo trạng thái/mã/SĐT · không có thao tác ghi</p></div></div>
    <form className="review-filters" onSubmit={(e) => { e.preventDefault(); setPage(0); void load(0, status); }} aria-label="Bộ lọc đơn hàng">
      <div className="review-filter"><label htmlFor="admin-order-code">Mã đơn</label><input id="admin-order-code" className="control" value={orderCode} onChange={(e) => setOrderCode(e.target.value)} placeholder="DH-…" /></div>
      <div className="review-filter"><label htmlFor="admin-order-phone">Số điện thoại</label><input id="admin-order-phone" className="control" value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" /></div>
      <button className="primary" type="submit" style={{ alignSelf: "end" }}>Lọc</button>
      <button className="text-link" type="button" onClick={() => { setOrderCode(""); setPhone(""); setStatus(""); setPage(0); void load(0, "", true); }}>Đặt lại</button>
    </form>
    <nav className="review-filters" aria-label="Lọc trạng thái">{FILTERS.map((f) => <button key={f.v || "all"} className={`text-link${status === f.v ? " active" : ""}`} type="button" aria-pressed={status === f.v} onClick={() => { setStatus(f.v); setPage(0); }}>{f.l}</button>)}</nav>
    {loading ? <p className="meta" role="status">Đang tải đơn…</p> : null}
    {error ? <div className="order-empty" role="alert"><strong>Không tải được đơn</strong><p>{error}</p><button className="text-link" type="button" onClick={() => load(page, status)}>Thử lại (giữ lọc)</button></div> : null}
    {!loading && !error && (data?.content?.length ?? 0) === 0 ? <div className="order-empty"><strong>Không có đơn khớp</strong><p>Thử bỏ lọc hoặc chọn trạng thái khác.</p></div> : null}
    {!loading && !error && data && (data?.content?.length ?? 0) > 0 ? <div className="table-scroll review-table-scroll" tabIndex={0} aria-label="Danh sách đơn hàng"><table className="review-orders-table"><caption>{data.totalElements} đơn · trang {data.pageNumber + 1}/{Math.max(1, data.totalPages)} · dữ liệu BE candidate, không có kênh/thanh toán trong DTO</caption><thead><tr><th>Mã đơn</th><th>Khách hàng</th><th>Ngày tạo</th><th>Trạng thái</th><th>Địa chỉ</th><th className="num">Tổng</th></tr></thead><tbody>{data.content.map((o) => <tr key={o.orderId}><td><Link className="text-link" href={`/quan-tri/don-hang/${o.orderId}`}>{o.orderCode}</Link></td><td>{o.customerName ?? "—"}<small>{o.customerPhone ?? ""}</small></td><td>{date(o.createdAt)}</td><td>{STATUS[o.status] ?? o.status}</td><td>{o.deliveryAddress ?? "—"}</td><td className="num">{money(o.totalAmount)}</td></tr>)}</tbody></table></div> : null}
    {data && data.totalPages > 1 ? <div className="review-summary"><button className="text-link" disabled={page === 0} onClick={() => { setPage(page - 1); void load(page - 1, status); }}>← Trước</button><span>Trang {page + 1} · {data.totalElements} đơn</span><button className="text-link" disabled={data.last} onClick={() => { setPage(page + 1); void load(page + 1, status); }}>Sau →</button></div> : null}
    <p className="meta" style={{ marginTop: 16 }}><Icon name="shopping-bag" /> Chỉ Quản trị viên/Quản lý nhận được dữ liệu này. Không có nút đổi trạng thái, hủy, POS hay thanh toán.</p>
  </AdminShellB>;
}
