"use client";

import "./f5.css";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { AdminShellB } from "./admin-shell";
import { notifyOrdersChanged } from "./admin-frame";
import { AdminModal } from "./modal";
import { Icon } from "./icons";
import { ReturnOrderLink } from "./return-order-link";
import { PointsRecalcButton } from "./points-recalc-button";
import { ProductImage } from "./product-image";
import { statusToneColor, StatusBadge, Num } from "./status-badge";
import { useToast } from "./toast";
import { useAdminCan } from "./use-admin-role";
import { TableSkeleton } from "./skeleton";
import { parseOrderNote, stripRecipientToken } from "@/lib/order-recipient";
import { formatDateTime, formatNumber } from "@/lib/admin-format";
import { getOrder, updateOrderStatus, cancelAdminOrder, recordCashCollection, OrderError, type OrderDetail } from "@/lib/admin-order-client";

const STATUS: Record<string, string> = { PENDING: "Mới tạo", CONFIRMED: "Đã xác nhận", PACKING: "Đang đóng gói", SHIPPING: "Đang giao", COMPLETED: "Hoàn thành", CANCELLED: "Đã hủy", RETURNED: "Đã trả lại", DRAFT: "Tạm lưu POS" };
const NEXT: Record<string, { target: string; label: string; confirm: string }> = {
  PENDING: { target: "CONFIRMED", label: "Xác nhận đơn", confirm: "Xác nhận đơn hàng" },
  CONFIRMED: { target: "PACKING", label: "Bắt đầu đóng gói", confirm: "Chuyển sang đóng gói" },
  PACKING: { target: "SHIPPING", label: "Bàn giao vận chuyển", confirm: "Chuyển sang đang giao" },
  SHIPPING: { target: "COMPLETED", label: "Hoàn tất đơn", confirm: "Hoàn tất đơn hàng" },
};
const STEPS = ["PENDING", "CONFIRMED", "PACKING", "SHIPPING", "COMPLETED"];
const statusLabel = (v: string) => STATUS[v] ?? v;
function paidMethodName(method: string | null): string {
  if (method === "STRIPE") return "Stripe";
  if (method === "VNPAY_QR" || method === "VNPAY") return "VNPay";
  if (method === "MOMO") return "MoMo";
  if (method === "BANK_TRANSFER") return "Chuyển khoản";
  if (method === "E_WALLET") return "Ví điện tử";
  if (method === "CASH") return "Tiền mặt";
  return method ?? "";
}
const CANCELLATION_NOTE = /\[HỦY ĐƠN\s*-\s*([^\]]*)\]\s*:\s*([^|\]]*)/g;
const STATUS_NOTE = new RegExp(`\\[(${Object.keys(STATUS).join("|")})\\]\\s*:\\s*([^|\\]]*)`, "g");
function noteParts(note: string | null): { cancellations: Array<{ actor: string; reason: string }>; transitions: Array<{ status: string; note: string }>; text: string } {
  let rest = note ?? "";
  rest = stripRecipientToken(rest);
  const cancellations: Array<{ actor: string; reason: string }> = [];
  rest = rest.replace(CANCELLATION_NOTE, (_whole, actor: string, reason: string) => {
    const who = actor.replace(/\s+/g, " ").trim().toLowerCase();
    const why = reason.replace(/\s+/g, " ").trim();
    if (why) cancellations.push({ actor: who, reason: why });
    return " ";
  });
  const transitions: Array<{ status: string; note: string }> = [];
  rest = rest.replace(STATUS_NOTE, (_whole, status: string, text: string) => {
    const clean = text.replace(/\s+/g, " ").trim();
    if (clean) transitions.push({ status, note: clean });
    return " ";
  });
  rest = rest.replace(/\s*\|\s*/g, " ").replace(/\s+/g, " ").trim();
  return { cancellations, transitions, text: rest };
}

export function OrderDetailClient({ id }: { id: string }) {
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [error, setError] = useState("");
  const [uncertain, setUncertain] = useState(false);
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const [note, setNote] = useState("");
  const [cancelReason, setCancelReason] = useState("");
  const [confirmingCancel, setConfirmingCancel] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [cashAmount, setCashAmount] = useState("");
  const [cashNote, setCashNote] = useState("");
  const [collecting, setCollecting] = useState(false);
  const [collectionRecorded, setCollectionRecorded] = useState(false);
  const [statusError, setStatusError] = useState("");
  const [cancelError, setCancelError] = useState("");
  const [cashError, setCashError] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmingFrom, setConfirmingFrom] = useState("");
  const [cashOpen, setCashOpen] = useState(false);
  const toast = useToast(); const can = useAdminCan();
  const busyRef = useRef(false);

  useEffect(() => {
    const c = new AbortController();
    getOrder(id, c.signal).then(setOrder).catch((e) => { if (!c.signal.aborted) setError(e instanceof Error ? e.message : "Không tải được đơn."); }).finally(() => { if (!c.signal.aborted) setLoading(false); });
    return () => c.abort();
  }, [id]);

  const back = typeof window !== "undefined" ? sessionStorage.getItem("admin-orders-return") || "/quan-tri/don-hang" : "/quan-tri/don-hang";
  const action = order ? NEXT[order.status] : undefined;
  const terminal = order && ["COMPLETED", "CANCELLED", "RETURNED", "DRAFT"].includes(order.status);
  const isPaid = order?.paymentStatus === "PAID";
  const canCancel = order && ["PENDING", "CONFIRMED", "PACKING"].includes(order.status) && !isPaid && can("ORDER_CANCEL");
  const noteView = noteParts(order?.note ?? null);
  const recipientNote = parseOrderNote(order?.note).recipient;
  const recipientName = recipientNote?.name || order?.customer?.fullName || "Chưa có tên";
  const recipientPhone = recipientNote?.phone || order?.customer?.phoneNumber || "Chưa có SĐT";

  async function submit() {
    if (!order || !action || busyRef.current) return;
    if (note.length > 1000) { setStatusError("Ghi chú tối đa 1000 ký tự."); return; }
    busyRef.current = true; setBusy(true); setStatusError(""); setError(""); setUncertain(false);
    try {
      const saved = await updateOrderStatus(id, action.target, note);
      setOrder(saved); setConfirming(false); setNote("");
      toast.success(`Đơn ${saved.orderCode} đã chuyển sang ${statusLabel(saved.status)}.`);
      notifyOrdersChanged();
      // Refetch after the write so the displayed state is the server's latest
      // snapshot, not the response used as an optimistic local truth.
      void getOrder(id).then(setOrder).catch(() => {});
    } catch (failure) {
      const known = failure instanceof OrderError;
      if (known) { setStatusError(failure.message); toast.error(failure.message); }
      else {
        const message = "Chưa xác định được trạng thái đã được cập nhật hay chưa. Không tự gửi lại; đang đối soát trạng thái mới nhất.";
        setConfirming(false); setError(message); setUncertain(true); toast.error(message);
      }
      // Reconcile with GET even on rejection/ambiguity; never retry the PATCH.
      try { const fresh = await getOrder(id); setOrder(fresh); notifyOrdersChanged(); } catch { /* keep the visible error */ }
    } finally { busyRef.current = false; setBusy(false); }
  }

  async function cancel() {
    if (!order || !canCancel || busyRef.current) return;
    if (!confirmingCancel) { setConfirmingCancel(true); return; }
    if (!cancelReason.trim()) { setCancelError("Nhập lý do hủy đơn."); return; }
    busyRef.current = true; setCancelling(true); setCancelError("");
    try { const saved = await cancelAdminOrder(id, cancelReason.trim()); setOrder(saved); setConfirmingCancel(false); setCancelReason(""); toast.success(`Đã hủy đơn ${saved.orderCode}.`); notifyOrdersChanged(); }
    catch (failure) { const message = failure instanceof OrderError ? failure.message : "Chưa xác định được kết quả hủy. Đọc lại trạng thái trước khi thao tác tiếp."; setCancelError(message); toast.error(message); setUncertain(false); try { setOrder(await getOrder(id)); } catch { /* keep the visible error */ } }
    finally { busyRef.current = false; setCancelling(false); }
  }

  async function collectCash() {
    if (!order || order.status !== "SHIPPING" || busyRef.current) return;
    const amount = cashAmount.trim() ? Number(cashAmount) : order.totalAmount;
    if (!Number.isFinite(amount) || amount < order.totalAmount) { setCashError("Số tiền thực thu phải ít nhất bằng số tiền còn phải thu."); return; }
    busyRef.current = true; setCollecting(true); setCashError("");
    try { await recordCashCollection(id, amount, cashNote.trim() || null); setCollectionRecorded(true); setCashOpen(false); toast.success("Đã ghi nhận thu tiền mặt."); void getOrder(id).then(setOrder).catch(() => {}); }
    catch (failure) { const message = failure instanceof OrderError ? failure.message : "Chưa xác định được kết quả ghi nhận thu tiền. Đối soát trước khi thử lại."; setCashError(message); toast.error(message); }
    finally { busyRef.current = false; setCollecting(false); }
  }

  const stepIndex = order ? STEPS.indexOf(order.status) : -1;
  const endState = order && (order.status === "CANCELLED" || order.status === "RETURNED") ? order.status : null;
  const canCollect = !!order && order.status === "SHIPPING" && !isPaid && !collectionRecorded && can("ORDER_COLLECT_CASH");
  const modalAction = confirmingFrom ? NEXT[confirmingFrom] : undefined;
  const nextOpen = confirming && !!order && order.status === confirmingFrom && !!modalAction;

  return <AdminShellB active="orders" title={order?.orderCode ?? "Chi tiết đơn"}>
    <Link className="back-link" href={back}>← Về danh sách đơn</Link>
    <div className="page-head od-head">
      <div className="page-head-title">
        <h1>{order?.orderCode ?? "Chi tiết đơn"}</h1>
        {order ? <StatusBadge status={order.status} label={statusLabel(order.status)} /> : null}
        {order ? <span className="meta">{formatDateTime(order.createdAt)}</span> : null}
        {order?.voucherCode ? <span className="meta">· Voucher {order.voucherCode}{order.voucherCampaignName ? ` (${order.voucherCampaignName})` : ""}</span> : null}
      </div>
      {order ? <div className="page-head-actions">
        {can("ORDER_VIEW") ? <><Link className="secondary btn-sm" href={`/quan-tri/don-hang/in?ids=${order.orderId}&type=invoice`} target="_blank">In hóa đơn</Link><Link className="secondary btn-sm" href={`/quan-tri/don-hang/in?ids=${order.orderId}&type=shipping`} target="_blank">In phiếu giao hàng</Link></> : null}
        {canCancel ? <button className="danger" type="button" disabled={busy || cancelling} onClick={() => { setCancelError(""); setConfirmingCancel(true); }}>Hủy đơn</button> : null}
        {canCollect ? <button className="secondary" type="button" disabled={busy} onClick={() => { setCashError(""); setCashOpen(true); }}>Thu tiền mặt</button> : null}
        {isPaid && order.customer && can("LOYALTY_ADJUST") ? <PointsRecalcButton orderId={id} /> : null}
        {action && can("ORDER_UPDATE_STATUS") ? <button className="primary" type="button" disabled={busy} onClick={() => { setStatusError(""); setError(""); setConfirmingFrom(order.status); setConfirming(true); }}>{action.label}</button> : null}
      </div> : null}
    </div>
    {loading ? <TableSkeleton rows={4} columns={5} rowHeight={52} /> : null}
    {error ? <div className="order-empty" role="alert"><strong>{order ? "Không cập nhật được trạng thái" : "Không tải được đơn"}</strong><p>{error}</p>{uncertain ? <p className="meta">Đã đọc lại trạng thái mới nhất; không gửi lại yêu cầu tự động. <Link className="text-link" href="/quan-tri/don-hang">Mở danh sách để đối soát</Link></p> : null}</div> : null}
    {order ? <>
      {can("RETURN_VIEW") && ["COMPLETED", "RETURNED"].includes(order.status) ? <ReturnOrderLink orderId={id} orderCode={order.orderCode ?? id} status={order.status} /> : null}
      <ol className="od-stepper" aria-label="Tiến trình đơn hàng">
        {STEPS.map((code, i) => {
          const tone = statusToneColor(code);
          const state = endState ? "todo" : i < stepIndex ? "done" : i === stepIndex ? "current" : "todo";
          return <li key={code} className={`od-step ${state}${state !== "todo" && tone ? ` t-${tone}` : ""}`} aria-current={state === "current" ? "step" : undefined}>
            <span className="od-step-dot" aria-hidden="true">{state === "done" ? <Icon name="check" /> : i + 1}</span>
            <span className="od-step-label">{statusLabel(code)}</span>
          </li>;
        })}
        {endState ? <li className={`od-step current end ${endState === "CANCELLED" ? "t-red" : "t-orange"}`} aria-current="step"><span className="od-step-dot" aria-hidden="true"><Icon name="circle-alert" /></span><span className="od-step-label">{statusLabel(endState)}</span></li> : null}
      </ol>
      {!action && !terminal ? <p className="order-finished">Chưa có bước chuyển hợp lệ · Trạng thái hiện tại: {statusLabel(order.status)}.</p> : null}
      {!terminal && isPaid ? <p className="od-note" role="note">Đã thanh toán{paidMethodName(order.paymentMethod) ? ` qua ${paidMethodName(order.paymentMethod)}` : ""}, nên không hủy được đơn.</p> : null}
      {collectionRecorded && !isPaid ? <p className="od-note" role="status">Đã ghi nhận thu tiền mặt. Có thể hoàn tất đơn.</p> : null}
      <div className="od-grid">
        <section className="od-card od-items" aria-label="Dòng hàng của đơn">
          <div className="table-scroll table-cards" tabIndex={0}><table className="review-orders-table"><caption className="sr-only">Sản phẩm trong đơn</caption><thead><tr><th>Sản phẩm</th><th className="num">SL</th><th className="num">Đơn giá</th><th className="num">Giảm</th><th className="num">Tạm tính</th></tr></thead><tbody>{order.items.map((i) => <tr key={i.skuId} className="has-thumb">
            <td data-label=""><div className="od-item"><span className="od-thumb"><ProductImage src={i.imageUrl} alt={i.productName} /></span><span className="od-item-text"><span className="cell-main" title={i.productName}>{i.productName}</span><small className="cell-sub">SKU {i.skuId}{[i.color, i.size].filter(Boolean).length ? ` · ${[i.color, i.size].filter(Boolean).join(" · ")}` : ""}</small></span></div></td>
            <td data-label="SL" className="num"><Num value={i.quantity} tone="blue" /></td>
            <td data-label="Đơn giá" className="num"><Num value={i.unitPrice} money tone="ink" /></td>
            <td data-label="Giảm" className="num"><Num value={i.discountAmount > 0 ? -i.discountAmount : 0} money tone="red" /></td>
            <td data-label="Tạm tính" className="num"><Num value={i.totalPrice} money tone="ink" bold /></td>
          </tr>)}</tbody></table></div>
        </section>
        <div className="od-side">
          <section className="od-card" aria-label="Người nhận">
            <h2>Người nhận</h2>
            <p className="od-line"><strong>{recipientName}</strong> <span className="meta">· {recipientPhone}</span></p>
            <p className="od-line">{order.deliveryAddress ?? "Chưa có địa chỉ"}</p>
            {noteView.cancellations.map((line, index) => <p className="od-line meta" key={`${line.actor}-${index}`}>Lý do hủy{line.actor ? ` (${line.actor})` : ""}: {line.reason}</p>)}
            {noteView.transitions.map((line, index) => <p className="od-line meta" key={`${line.status}-${index}`}>Chuyển sang {statusLabel(line.status)}: {line.note}</p>)}
            {noteView.text ? <p className="od-line meta">Ghi chú: {noteView.text}</p> : null}
          </section>
          <section className="od-card" aria-label="Thanh toán">
            <h2>Thanh toán</h2>
            {(order.refundedAmount ?? 0) > 0 ? <p className="od-line">Đã hoàn {formatNumber(order.refundedAmount ?? 0)}đ / Đã trả {formatNumber(order.paidAmount ?? 0)}đ</p> : null}
            <p className="od-line"><StatusBadge status={order.paymentStatus === "REFUNDED" ? "REFUNDED" : order.paymentStatus === "PAID" ? "PAID" : "UNPAID"} tone={order.paymentStatus !== "PAID" && endState ? "gray" : undefined} label={(order.refundedAmount ?? 0) > 0 && (order.refundedAmount ?? 0) < (order.paidAmount ?? 0) ? "Đã hoàn một phần" : order.paymentStatus === "REFUNDED" ? "Đã hoàn tiền" : order.paymentStatus === "PAID" ? "Đã thanh toán" : "Chưa ghi nhận thanh toán"} />{isPaid && paidMethodName(order.paymentMethod) ? <span className="meta"> · {paidMethodName(order.paymentMethod)}</span> : null}</p>
          </section>
          <section className="od-card order-totals" aria-label="Tổng đơn">
            <h2>Tổng đơn</h2>
            <dl className="od-totals">
              <div><dt>Tạm tính</dt><dd><Num value={order.subTotal} money tone="ink" dimZero={false} /></dd></div>
              {order.discountAmount > 0 ? <div><dt>{order.voucherCode ? `Voucher ${order.voucherCode}${order.voucherCampaignName ? ` (${order.voucherCampaignName})` : ""}` : "Giảm voucher"}</dt><dd><Num value={-order.discountAmount} money tone="red" /></dd></div> : null}
              {(order.pointsDiscount ?? 0) > 0 ? <div><dt>Đổi <b className="t-amber">{formatNumber(order.redeemedPoints ?? 0)} điểm</b></dt><dd><Num value={-(order.pointsDiscount ?? 0)} money tone="red" /></dd></div> : null}
              <div><dt>Phí giao hàng</dt><dd><Num value={order.shippingFee} money tone="ink" dimZero={false} /></dd></div>
              <div className="od-total"><dt>Tổng cộng</dt><dd><Num value={order.totalAmount} money tone={isPaid ? "green" : "ink"} bold dimZero={false} /></dd></div>
            </dl>
          </section>
        </div>
      </div>
    </> : null}

    <AdminModal open={nextOpen} title={modalAction ? `${modalAction.confirm}?` : ""} size="sm" busy={busy} onClose={() => { if (!busyRef.current) { setConfirming(false); setStatusError(""); } }}
      footer={<><button className="secondary" type="button" disabled={busy} onClick={() => { setConfirming(false); setStatusError(""); }}>Hủy</button><button className="primary" type="button" disabled={busy} aria-busy={busy} onClick={() => void submit()}>{busy ? "Đang cập nhật…" : modalAction?.confirm}</button></>}>
      {order && modalAction ? <>
        <p className="adm-modal-text">Đơn <strong>{order.orderCode}</strong>: {statusLabel(order.status)} → <strong>{statusLabel(modalAction.target)}</strong>.</p>
        <p className="meta">{modalAction.target === "COMPLETED" ? "Với đơn COD hoặc có ưu đãi, cần ghi nhận tiền thực thu ở bước Đang giao trước khi hoàn tất. Hoàn tất sẽ trừ tồn vật lý và tạm giữ; tồn khả dụng được giữ nguyên." : "Bước này không thay đổi tồn kho."}</p>
        <div className="catalog-field"><label htmlFor="order-confirm-note">Ghi chú xử lý (không bắt buộc)</label><textarea id="order-confirm-note" className="catalog-input" maxLength={1000} rows={3} value={note} onChange={(e) => setNote(e.target.value)} disabled={busy} /></div>
        {statusError ? <p className="catalog-error" role="alert">{statusError}</p> : null}
      </> : null}
    </AdminModal>

    <AdminModal open={confirmingCancel && !!canCancel} title="Hủy đơn?" size="sm" busy={cancelling} onClose={() => { if (!busyRef.current) setConfirmingCancel(false); }}
      footer={<><button className="secondary" type="button" disabled={cancelling} onClick={() => setConfirmingCancel(false)}>Giữ đơn</button><button className="danger solid" type="button" disabled={cancelling} aria-busy={cancelling} onClick={() => void cancel()}>{cancelling ? "Đang hủy…" : "Xác nhận hủy"}</button></>}>
      <p className="meta">Hệ thống sẽ trả lại hàng vào kho và hoàn lại voucher của đơn này. Thao tác không hoàn tác được.</p>
      <div className="catalog-field"><label htmlFor="admin-cancel-reason">Lý do hủy</label><textarea id="admin-cancel-reason" className="catalog-input" rows={3} maxLength={500} value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} disabled={cancelling} /></div>
      {cancelError ? <p className="catalog-error" role="alert">{cancelError}</p> : null}
    </AdminModal>

    <AdminModal open={cashOpen && !!order && canCollect} title="Thu tiền mặt" size="sm" busy={collecting} onClose={() => { if (!busyRef.current) setCashOpen(false); }}
      footer={<><button className="secondary" type="button" disabled={collecting} onClick={() => setCashOpen(false)}>Hủy</button><button className="primary" type="button" disabled={collecting} aria-busy={collecting} onClick={() => void collectCash()}>{collecting ? "Đang ghi nhận…" : "Xác nhận đã thu"}</button></>}>
      <p className="meta">Chỉ ghi nhận sau khi đã thực nhận tiền. Thao tác ghi hóa đơn đã thanh toán bằng tiền mặt.</p>
      {order ? <div className="catalog-field"><label htmlFor="cash-amount">Số tiền thực nhận (tối thiểu {formatNumber(order.totalAmount)} VND)</label><input id="cash-amount" className="catalog-input" type="number" min={order.totalAmount} step="0.01" value={cashAmount || String(order.totalAmount)} onChange={(e) => setCashAmount(e.target.value)} disabled={collecting} /></div> : null}
      <div className="catalog-field"><label htmlFor="cash-note">Ghi chú (tùy chọn)</label><input id="cash-note" className="catalog-input" value={cashNote} onChange={(e) => setCashNote(e.target.value)} disabled={collecting} /></div>
      {cashError ? <p className="catalog-error" role="alert">{cashError}</p> : null}
    </AdminModal>
  </AdminShellB>;
}
