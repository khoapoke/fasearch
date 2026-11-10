"use client";
import Link from "next/link";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AdminShellB } from "./admin-shell";
import { useAdminCan } from "./use-admin-role";
import { getOrder, type OrderDetail } from "@/lib/admin-order-client";
import { barcodePath, code128Widths, isCode128Encodable } from "@/lib/barcode";
import { formatDateTime, formatNumber } from "@/lib/admin-format";
import { parseCustomerOrderNote } from "@/lib/order-recipient";
import { orderDeliveryNote } from "@/lib/order-delivery-note";
import "./p1.css";

function Barcode({ code }: { code: string }) {
  if (!isCode128Encodable(code)) return <p>Không in được Barcode: {code}</p>;
  const bits = code128Widths(code).map((n, i) => (i % 2 ? "0" : "1").repeat(n)).join("");
  const { d, total } = barcodePath({ kind: "CODE128", text: code, bits });
  return <div className="p1-barcode"><svg viewBox={`0 0 ${total} 1`} preserveAspectRatio="none" shapeRendering="crispEdges" role="img" aria-label={`Barcode ${code}`}><path fill="black" d={d} /></svg><div>{code}</div></div>;
}
const money = (amount: number) => `${formatNumber(amount)} đ`;
function Sheet({ order, type }: { order: OrderDetail; type: "invoice" | "shipping" }) {
  const sheetRef = useRef<HTMLElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const sheet = sheetRef.current; const content = contentRef.current;
    if (!sheet || !content) return;
    const fit = () => {
      content.style.zoom = "1";
      const style = getComputedStyle(sheet);
      const available = sheet.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom);
      if (content.scrollHeight > available) content.style.zoom = String(available / content.scrollHeight);
    };
    fit(); void document.fonts.ready.then(fit);
  }, [order, type]);
  const count = order.items.reduce((sum, item) => sum + item.quantity, 0);
  const buyer = { name: order.customerName || order.customer?.fullName || "", phone: order.customerPhone || order.customer?.phoneNumber || "" };
  const note = parseCustomerOrderNote(order.note);
  const recipient = { name: note.recipient?.name || buyer.name, phone: note.recipient?.phone || buyer.phone };
  const differentRecipient = recipient.name !== buyer.name || recipient.phone !== buyer.phone;
  return <article className="p1-sheet" ref={sheetRef}><div ref={contentRef}>
    <header><div><strong className="p1-shop">FaSearch</strong><h1>{type === "invoice" ? "HÓA ĐƠN BÁN HÀNG" : "PHIẾU GIAO HÀNG"}</h1><div>Ngày: {formatDateTime(order.createdAt)}</div></div><Barcode code={order.orderCode} /></header>
    {type === "shipping" ? <><section className="p1-recipient"><h2>Người nhận</h2><strong>{recipient.name || "Chưa có tên"}</strong><div>{recipient.phone || "Chưa có số điện thoại"}</div><div>{order.deliveryAddress || "Chưa có địa chỉ"}</div><p>Ghi chú: {orderDeliveryNote(order.note) || "Không có"}</p></section><div className="p1-cod">Thu hộ COD: <strong>{money(order.paymentStatus === "PAID" || order.paymentStatus === "REFUNDED" || order.status === "CANCELLED" || order.status === "RETURNED" ? 0 : order.totalAmount)}</strong></div><p>Số lượng sản phẩm: <strong>{count}</strong></p></> : <><section className="p1-customer"><strong>Khách hàng: {buyer.name || "Chưa có tên"}</strong><div>{buyer.phone}</div>{differentRecipient ? <div>Người nhận: {recipient.name} · {recipient.phone}</div> : null}<div>{order.deliveryAddress || ""}</div></section><table><thead><tr><th>SKU / Sản phẩm / Phân loại</th><th>SL</th><th>Đơn giá</th><th>Thành tiền</th></tr></thead><tbody>{order.items.map((item, index) => <tr key={index}><td>SKU {item.skuId} · {item.productName}<br />{[item.color, item.size].filter(Boolean).join(" / ")}</td><td>{item.quantity}</td><td>{money(item.unitPrice)}</td><td>{money(item.totalPrice)}</td></tr>)}</tbody></table><div className="p1-totals"><div>Tạm tính <strong>{money(order.subTotal)}</strong></div>{order.discountAmount > 0 ? <div>Giảm Voucher <strong>−{money(order.discountAmount)}</strong></div> : null}{(order.pointsDiscount ?? 0) > 0 ? <div>Giảm điểm <strong>−{money(order.pointsDiscount ?? 0)}</strong></div> : null}<div>Phí giao hàng <strong>{money(order.shippingFee)}</strong></div><div className="p1-total">Tổng cộng <strong>{money(order.totalAmount)}</strong></div></div><p>Thanh toán: <strong>{order.paymentStatus === "PAID" ? "Đã thanh toán" : order.paymentStatus === "REFUNDED" ? "Đã hoàn tiền" : "Chưa thanh toán"}</strong></p></>}
  </div></article>;
}
export function OrderPrintPage() {
  const can = useAdminCan();
  const [state, setState] = useState<{ orders: OrderDetail[]; errors: string[]; type: "invoice" | "shipping"; loading: boolean }>({ orders: [], errors: [], type: "invoice", loading: true });
  const [root, setRoot] = useState<HTMLElement | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams(window.location.search); const type = params.get("type") === "shipping" ? "shipping" : "invoice";
    const raw = params.get("ids") ?? "";
    const ids = [...new Set(raw.split(",").filter((id) => /^[1-9]\d*$/.test(id) && Number.isSafeInteger(Number(id))))].slice(0, 50);
    const el = document.createElement("div"); el.id = "p1-print-root"; el.setAttribute("aria-hidden", "true"); document.body.appendChild(el);
    void Promise.resolve().then(() => setRoot(el));
    void Promise.all(ids.map(async (id) => { try { return { order: await getOrder(id, controller.signal), error: "" }; } catch (e) { return { order: null, error: `Đơn ${id}: ${e instanceof Error ? e.message : "Không tải được đơn."}` }; } })).then((results) => { if (!controller.signal.aborted) setState({ orders: results.flatMap((r) => r.order ? [r.order] : []), errors: results.flatMap((r) => r.error ? [r.error] : []), type, loading: false }); });
    return () => { controller.abort(); el.remove(); };
  }, []);
  const sheets = <>{state.orders.map((order) => <Sheet key={order.orderId} order={order} type={state.type} />)}</>;
  return <AdminShellB active="orders" title="In đơn hàng"><Link className="back-link" href="/quan-tri/don-hang">← Về danh sách đơn</Link><div className="page-head"><div><h1>{state.type === "invoice" ? "In hóa đơn" : "In phiếu giao hàng"}</h1><p>Khổ A5 dọc · chọn tỉ lệ 100% khi in.</p></div><button className="primary" disabled={state.loading || !state.orders.length || state.errors.length > 0 || !can("ORDER_VIEW")} onClick={() => window.print()}>In {state.orders.length} đơn</button></div>{state.loading ? <p>Đang tải đơn…</p> : null}{state.errors.length ? <div role="alert">Không thể in đầy đủ các đơn:<ul>{state.errors.map((error, i) => <li key={i}>{error}</li>)}</ul></div> : null}{!state.loading && !state.orders.length && !state.errors.length ? <p>Không có đơn hợp lệ để in.</p> : null}<div className="p1-preview">{sheets}</div>{root && can("ORDER_VIEW") && !state.errors.length ? createPortal(<><style>{"@page{size:A5 portrait;margin:0}"}</style>{sheets}</>, root) : null}</AdminShellB>;
}
