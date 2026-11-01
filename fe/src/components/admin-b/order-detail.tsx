"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { AdminShellB } from "./admin-shell";
import { getOrder, updateOrderStatus, cancelAdminOrder, recordCashCollection, OrderError, type OrderDetail } from "@/lib/admin-order-client";

const STATUS: Record<string, string> = { PENDING: "Mới tạo", CONFIRMED: "Đã xác nhận", PACKING: "Đang đóng gói", SHIPPING: "Đang giao", COMPLETED: "Hoàn thành", CANCELLED: "Đã hủy", RETURNED: "Đã trả lại", DRAFT: "Tạm lưu POS" };
const NEXT: Record<string, { target: string; label: string; confirm: string }> = {
  PENDING: { target: "CONFIRMED", label: "Xác nhận đơn", confirm: "Xác nhận đơn hàng" },
  CONFIRMED: { target: "PACKING", label: "Bắt đầu đóng gói", confirm: "Chuyển sang đóng gói" },
  PACKING: { target: "SHIPPING", label: "Bàn giao vận chuyển", confirm: "Chuyển sang đang giao" },
  SHIPPING: { target: "COMPLETED", label: "Hoàn tất đơn", confirm: "Hoàn tất đơn hàng" },
};
const money = (v: number) => <span className="money">{v.toLocaleString("vi-VN")}<span className="unit">VND</span></span>;
const statusLabel = (v: string) => STATUS[v] ?? v;

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
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);

  useEffect(() => {
    const c = new AbortController();
    getOrder(id, c.signal).then(setOrder).catch((e) => { if (!c.signal.aborted) setError(e instanceof Error ? e.message : "Không tải được đơn."); }).finally(() => { if (!c.signal.aborted) setLoading(false); });
    return () => c.abort();
  }, [id]);

  const back = typeof window !== "undefined" ? sessionStorage.getItem("admin-orders-return") || "/quan-tri/don-hang" : "/quan-tri/don-hang";
  const action = order ? NEXT[order.status] : undefined;
  const terminal = order && ["COMPLETED", "CANCELLED", "RETURNED", "DRAFT"].includes(order.status);
  const canCancel = order && ["PENDING", "CONFIRMED", "PACKING"].includes(order.status);

  async function submit() {
    if (!order || !action || busyRef.current) return;
    if (note.length > 1000) { setError("Ghi chú tối đa 1000 ký tự."); return; }
    busyRef.current = true; setBusy(true); setError(""); setUncertain(false);
    try {
      const saved = await updateOrderStatus(id, action.target, note);
      setOrder(saved); setConfirming(false); setNote("");
      // Refetch after the write so the displayed state is the server's latest
      // snapshot, not the response used as an optimistic local truth.
      void getOrder(id).then(setOrder).catch(() => {});
    } catch (failure) {
      const known = failure instanceof OrderError;
      setError(known ? failure.message : "Chưa xác định được trạng thái đã được cập nhật hay chưa. Không tự gửi lại; đang đối soát trạng thái thật.");
      setUncertain(!known);
      // Reconcile with GET even on rejection/ambiguity; never retry the PATCH.
      try { const fresh = await getOrder(id); setOrder(fresh); } catch { /* keep the visible error */ }
    } finally { busyRef.current = false; setBusy(false); }
  }

  async function cancel() {
    if (!order || !canCancel || busyRef.current) return;
    if (!confirmingCancel) { setConfirmingCancel(true); return; }
    if (!cancelReason.trim()) { setError("Nhập lý do hủy đơn."); return; }
    busyRef.current = true; setCancelling(true); setError("");
    try { setOrder(await cancelAdminOrder(id, cancelReason.trim())); setConfirmingCancel(false); setCancelReason(""); }
    catch (failure) { setError(failure instanceof OrderError ? failure.message : "Chưa xác định được kết quả hủy. Đọc lại trạng thái trước khi thao tác tiếp."); setUncertain(!(failure instanceof OrderError)); try { setOrder(await getOrder(id)); } catch { /* keep the visible error */ } }
    finally { busyRef.current = false; setCancelling(false); }
  }

  async function collectCash() {
    if (!order || order.status !== "SHIPPING" || busyRef.current) return;
    const amount = cashAmount.trim() ? Number(cashAmount) : order.totalAmount;
    if (!Number.isFinite(amount) || amount < order.totalAmount) { setError("Số tiền thực thu phải ít nhất bằng số tiền còn phải thu."); return; }
    busyRef.current = true; setCollecting(true); setError(""); setUncertain(false);
    try { await recordCashCollection(id, amount, cashNote.trim() || null); setCollectionRecorded(true); void getOrder(id).then(setOrder).catch(() => {}); }
    catch (failure) { setError(failure instanceof OrderError ? failure.message : "Chưa xác định được kết quả ghi nhận thu tiền. Đối soát trước khi thử lại."); setUncertain(!(failure instanceof OrderError)); }
    finally { busyRef.current = false; setCollecting(false); }
  }

  return <AdminShellB active="orders" title="Chi tiết đơn" eyebrow="Vận hành · cập nhật tuần tự theo trạng thái BE">
    <div className="page-heading"><div><h1>Chi tiết đơn</h1><p className="meta">Dữ liệu BE candidate · mỗi lần chỉ cập nhật bước kế tiếp · không có kênh/thanh toán trong DTO</p></div><Link className="text-link" href={back}>← Về danh sách</Link></div>
    {loading ? <p className="meta" role="status">Đang tải đơn…</p> : null}
    {error ? <div className="order-empty" role="alert"><strong>Không cập nhật được trạng thái</strong><p>{error}</p>{uncertain ? <p className="meta">Đã thử đọc lại trạng thái thật; không gửi lại yêu cầu tự động. <Link className="text-link" href="/quan-tri/don-hang">Mở danh sách để đối soát</Link></p> : null}</div> : null}
    {order ? <>
      <div className="section-head"><div><h2>{order.orderCode}</h2><p className="meta">{new Date(order.createdAt).toLocaleString("vi-VN")} · {statusLabel(order.status)}</p>{order.voucherCode ? <p className="meta">Voucher {order.voucherCode} · {order.voucherCampaignName} · phiên bản {order.voucherCampaignVersion}</p> : null}</div><strong>{money(order.totalAmount)}</strong></div>
      {action ? <section className="order-action" aria-label="Bước xử lý tiếp theo">
        <div><p className="section-label">Bước kế tiếp</p><h2>{action.label}</h2><p className="meta">{statusLabel(order.status)} → {statusLabel(action.target)}. Server sẽ kiểm tra lại thứ tự và trạng thái hiện tại.</p></div>
        {!confirming ? <button className="primary" type="button" onClick={() => { setConfirming(true); setError(""); }}>{action.label}</button> : <div className="order-confirm" role="group" aria-label={action.confirm}>
          <p><strong>Xác nhận {action.confirm.toLowerCase()}</strong> cho đơn <strong>{order.orderCode}</strong>: {statusLabel(order.status)} → <strong>{statusLabel(action.target)}</strong>.</p>
          <p className="meta">{action.target === "COMPLETED" ? "Khi đơn có ưu đãi/COD, thu tiền thực tế tạo hóa đơn đã thanh toán tại trạng thái SHIPPING trước khi hoàn tất. Hoàn tất sẽ trừ tồn vật lý (physical) và tạm giữ (reserved); tồn khả dụng (available) được bảo toàn theo hợp đồng BE." : "Bước này không thay đổi tồn kho."}</p>
          <label htmlFor="order-confirm-note">Ghi chú xử lý (không bắt buộc, ≤1000)</label>
          <textarea id="order-confirm-note" className="catalog-input order-confirm-note" maxLength={1000} rows={3} value={note} onChange={(e) => setNote(e.target.value)} disabled={busy} />
          <div className="catalog-actions"><button className="primary" type="button" disabled={busy} onClick={() => void submit()}>{busy ? "Đang cập nhật…" : action.confirm}</button><button className="text-link" type="button" disabled={busy} onClick={() => { setConfirming(false); setError(""); }}>Hủy</button></div>
        </div>}
      </section> : terminal ? <div className="order-empty"><strong>Đơn đã kết thúc hoặc không có bước kế tiếp</strong><p>Trạng thái hiện tại: {statusLabel(order.status)}. Không có thao tác chuyển trạng thái tùy ý trong candidate.</p></div> : <div className="order-empty"><strong>Chưa có bước chuyển hợp lệ</strong><p>Trạng thái hiện tại: {statusLabel(order.status)}.</p></div>}
      {canCancel ? <section className="order-action" aria-label="Hủy đơn bởi quản trị viên"><div><p className="section-label">Hủy đơn</p><p className="meta">Có thể hủy trước khi bàn giao; máy chủ khôi phục tồn và giải phóng voucher đúng một lần.</p></div>{!confirmingCancel ? <button className="text-link" type="button" disabled={busy || cancelling} onClick={() => setConfirmingCancel(true)}>Hủy đơn</button> : <div className="order-confirm"><label htmlFor="admin-cancel-reason">Lý do hủy</label><textarea id="admin-cancel-reason" className="catalog-input order-confirm-note" rows={2} maxLength={500} value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} disabled={cancelling} /><div className="catalog-actions"><button className="primary" type="button" disabled={cancelling} onClick={() => void cancel()}>{cancelling ? "Đang hủy…" : "Xác nhận hủy"}</button><button className="text-link" type="button" disabled={cancelling} onClick={() => setConfirmingCancel(false)}>Giữ đơn</button></div></div>}</section> : null}
      {order.status === "SHIPPING" ? <section className="order-action" aria-label="Ghi nhận thu COD"><div><p className="section-label">Thu COD thực tế</p><h2>{collectionRecorded ? "Đã ghi nhận trong phiên này" : "Ghi nhận tiền mặt đã nhận"}</h2><p className="meta">Chỉ thao tác sau khi nhân viên/đơn vị vận chuyển thực sự nhận tiền. Ghi nhận CASH tạo invoice tại SHIPPING và giải quyết ưu đãi nguyên tử; đây không phải cổng thanh toán.</p></div>{collectionRecorded ? <p role="status">Invoice/CASH đã được gửi tới máy chủ. Có thể chuyển sang Hoàn tất đơn để xử lý tồn kho.</p> : <div className="order-confirm"><label htmlFor="cash-amount">Số tiền thực nhận (tối thiểu {order.totalAmount.toLocaleString("vi-VN")} VND)</label><input id="cash-amount" className="catalog-input" type="number" min={order.totalAmount} step="0.01" value={cashAmount || String(order.totalAmount)} onChange={(e) => setCashAmount(e.target.value)} disabled={collecting} /><label htmlFor="cash-note">Ghi chú thu tiền (tùy chọn)</label><input id="cash-note" className="catalog-input" value={cashNote} onChange={(e) => setCashNote(e.target.value)} disabled={collecting} /><div className="catalog-actions"><button className="primary" type="button" disabled={collecting} onClick={() => void collectCash()}>{collecting ? "Đang ghi nhận…" : "Xác nhận đã thu tiền mặt"}</button></div></div>}</section> : null}
      <div className="table-scroll" tabIndex={0} aria-label="Dòng hàng của đơn"><table className="review-orders-table"><caption>Dòng hàng thật; kênh bán và phương thức thanh toán không có trong DTO nên không suy đoán.</caption><thead><tr><th>SKU</th><th>Sản phẩm</th><th>Màu / cỡ</th><th className="num">SL</th><th className="num">Đơn giá</th><th className="num">Tổng dòng</th><th className="num">Giảm phân bổ</th></tr></thead><tbody>{order.items.map((i) => <tr key={i.skuId}><td>{i.skuId}</td><td>{i.productName}</td><td>{[i.color, i.size].filter(Boolean).join(" · ") || "—"}</td><td className="num">{i.quantity}</td><td className="num">{money(i.unitPrice)}</td><td className="num">{money(i.totalPrice)}</td><td className="num">{money(i.discountAmount)}</td></tr>)}</tbody></table></div>
      <div className="desk-grid" style={{ marginTop: 20 }}><section className="workbench"><h2>Người nhận</h2><p className="meta">{order.customer?.fullName ?? "Không có tên"} · {order.customer?.phoneNumber ?? "Không có SĐT"}</p><p className="order-prose">{order.deliveryAddress ?? "Không có địa chỉ"}</p>{order.note ? <p className="meta order-prose">Ghi chú: {order.note}</p> : null}<p className="meta">Kênh bán: không có trong DTO · Phương thức thanh toán: không có trong DTO · Không suy đoán COD/POS.</p></section><aside className="finance-desk"><h2>Tổng đơn</h2><div className="comparison"><span>Tạm tính</span><b>{money(order.subTotal)}</b></div>{order.discountAmount > 0 ? <div className="comparison"><span>{order.voucherCode ? `Voucher ${order.voucherCode}` : "Giảm voucher"}</span><b>−{money(order.discountAmount)}</b></div> : null}{(order.pointsDiscount ?? 0) > 0 ? <div className="comparison"><span>Đổi {order.redeemedPoints ?? 0} điểm</span><b>−{money(order.pointsDiscount ?? 0)}</b></div> : null}<div className="comparison"><span>Phí giao hàng</span><b>{money(order.shippingFee)}</b></div><div className="revenue" style={{ fontSize: 24 }}>{money(order.totalAmount)}</div></aside></div>
    </> : null}
  </AdminShellB>;
}
