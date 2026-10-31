"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { StorefrontShell } from "@/components/storefront/storefront-shell";
import { cancelCustomerOrder, fetchCustomerOrder } from "@/lib/customer-commerce-client";
import { CommerceError, formatMoney, orderStatusText, type CustomerOrderDetail } from "@/lib/customer-commerce";
import { discountLines } from "@/lib/commerce";
import "@/components/customer-commerce/commerce.css";

function dateText(value: string): string {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : new Intl.DateTimeFormat("vi-VN", { dateStyle: "medium", timeStyle: "short" }).format(d);
}

export default function OrderDetailPage() {
  const params = useParams<{ id: string }>();
  const id = typeof params?.id === "string" ? params.id : "";
  const [order, setOrder] = useState<CustomerOrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [errorStatus, setErrorStatus] = useState(0);
  const [reason, setReason] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const busy = useRef(false);
  const errorRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    if (!/^\d+$/.test(id)) { setError("Mã đơn chưa hợp lệ."); setLoading(false); return; }
    setLoading(true); setError("");
    try { setOrder(await fetchCustomerOrder(id)); }
    catch (failure) { setErrorStatus(failure instanceof CommerceError ? failure.status : 0); setError(failure instanceof Error ? failure.message : "Không tải được đơn."); }
    finally { setLoading(false); }
  }, [id]);

  useEffect(() => { void Promise.resolve().then(() => load()); }, [load]);

  useEffect(() => {
    if (error) errorRef.current?.focus();
  }, [error]);

  async function cancel() {
    if (!order || busy.current) return;
    if (!confirming) { setConfirming(true); return; }
    if (!reason.trim()) { setError("Nhập lý do hủy đơn."); return; }
    busy.current = true; setCancelling(true); setError("");
    try { setOrder(await cancelCustomerOrder(String(order.orderId), reason.trim())); setConfirming(false); setReason(""); }
    catch (failure) { setError(failure instanceof Error ? failure.message : "Không hủy được đơn."); }
    finally { busy.current = false; setCancelling(false); }
  }

  const cancellable = order && (order.status === "PENDING" || order.status === "CONFIRMED");
  return (
    <StorefrontShell active="/tai-khoan" themed palette="customer" header="customer" footer="none">
      <div className="commercePage"><div className="commerce-content">
        <nav className="commerce-crumbs" aria-label="Đường dẫn"><Link href="/tai-khoan">Tài khoản</Link><span aria-hidden="true">›</span><Link href="/don-hang">Đơn hàng</Link><span aria-hidden="true">›</span><span aria-current="page">#{id}</span></nav>
        <h1 className="commerce-title">Chi tiết đơn</h1>
        <p className="commerce-sub">Dữ liệu đơn của tài khoản đang đăng nhập, trả về từ máy chủ thử nghiệm.</p>
        <p><Link className="commerce-link" href="/don-hang">← Về danh sách đơn</Link></p>
        {loading ? <p className="commerce-status" role="status">Đang tải đơn…</p> : null}
        {error ? <div ref={errorRef} tabIndex={-1} className="commerce-empty" role="alert"><h2>Không tải được đơn</h2><p>{error}{errorStatus === 401 ? <> <Link className="commerce-link" href="/dang-nhap?next=%2Ftai-khoan">Đăng nhập →</Link></> : null}</p><button className="commerce-ghost" type="button" onClick={load}>Thử lại</button></div> : null}
        {order ? (
          <div className="commerce-layout">
            <section className="commerce-panel" aria-label={`Đơn ${order.orderCode}`}>
              <div className="commerce-toolbar"><div><strong>{order.orderCode}</strong><p className="commerce-note">{dateText(order.createdAt)} · {orderStatusText(order.status)}</p></div><strong>{formatMoney(order.totalAmount)}</strong></div>
              <ul className="commerce-lines">
                {order.items.map((line) => (
                  <li className="commerce-line" key={line.skuId}>
                    {line.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element -- image from candidate BE
                      <img className="commerce-line-image" src={line.imageUrl} alt="" referrerPolicy="no-referrer" />
                    ) : <span className="commerce-line-image" aria-hidden="true" />}
                    <div><p className="commerce-line-name">{line.productName}</p><p className="commerce-line-meta">{[line.color, line.size].filter(Boolean).join(" · ") || "—"} · SL {line.quantity} · Đơn giá {formatMoney(line.unitPrice)}{order.voucherCode && line.discountAmount > 0 ? ` · Giảm voucher ${formatMoney(line.discountAmount)}` : ""}{(line.pointsDiscountAmount ?? 0) > 0 ? ` · Giảm điểm ${formatMoney(line.pointsDiscountAmount ?? 0)}` : ""}</p></div>
                    <strong className="commerce-line-total">{formatMoney(line.totalPrice)}</strong>
                  </li>
                ))}
              </ul>
              <p className="commerce-note">Người nhận: {order.customer?.fullName ?? "—"} · {order.customer?.phoneNumber ?? "—"}<br />Địa chỉ: {order.deliveryAddress ?? "—"}{order.note ? <><br />Ghi chú: {order.note}</> : null}</p>
              {cancellable ? (
                <div className="commerce-summary" style={{ position: "static", marginTop: 18 }}>
                  <h2>Hủy đơn của tôi</h2>
                  <p className="commerce-note">Chỉ hủy khi đơn còn Chờ xác nhận hoặc Đã xác nhận. BE sẽ kiểm tra lại quyền sở hữu và trạng thái.</p>
                  {!confirming ? <button className="commerce-ghost" type="button" onClick={() => setConfirming(true)}>Tôi muốn hủy đơn</button> : (
                    <div>
                      <div className="checkout-field"><label htmlFor="cancel-reason">Lý do hủy</label><input id="cancel-reason" className="checkout-input" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} /></div>
                      <button className="commerce-primary" type="button" disabled={cancelling} onClick={cancel}>{cancelling ? "Đang hủy…" : "Xác nhận hủy đơn"}</button>
                      <button className="commerce-ghost" type="button" disabled={cancelling} onClick={() => { setConfirming(false); setReason(""); }}>Không hủy</button>
                    </div>
                  )}
                </div>
              ) : <p className="commerce-note">Đơn ở trạng thái này không cho khách tự hủy. Không có nút thay đổi trạng thái của nhân viên.</p>}
            </section>
            <aside className="commerce-summary" aria-label="Tổng đơn">
              <h2>Tổng đơn</h2>
              <div className="commerce-summary-row"><span>Tạm tính</span><strong>{formatMoney(order.subTotal)}</strong></div>
              {order.voucherCode ? <div className="commerce-summary-row"><span>Voucher {order.voucherCode} · {order.voucherCampaignName} (phiên bản {order.voucherCampaignVersion})</span><strong>−{formatMoney(order.discountAmount)}</strong></div> : null}
              {(order.redeemedPoints ?? 0) > 0 || (order.pointsDiscount ?? 0) > 0 ? <div className="commerce-summary-row"><span>Đổi {order.redeemedPoints ?? 0} điểm</span><strong>−{order.pointsDiscount === null ? "—" : formatMoney(order.pointsDiscount)}</strong></div> : null}
              {!order.voucherCode && (order.redeemedPoints ?? 0) === 0 && !order.pointsDiscount ? discountLines({ giamGia: order.discountAmount }).map((line) => (
                <div className="commerce-summary-row" key={line.label}><span>{line.label}</span><strong>{line.amount === null ? "—" : formatMoney(line.amount)}</strong></div>
              )) : null}
              <div className="commerce-summary-row"><span>Phí giao hàng</span><strong>{formatMoney(order.shippingFee)}</strong></div>
              <div className="commerce-summary-total"><span>Tổng cộng</span><strong>{formatMoney(order.totalAmount)}</strong></div>
              <p className="commerce-note">Trạng thái: {orderStatusText(order.status)} · Thanh toán COD, thu khi nhận. Không có trạng thái “đã thanh toán” giả.</p>
            </aside>
          </div>
        ) : null}
      </div></div>
    </StorefrontShell>
  );
}
