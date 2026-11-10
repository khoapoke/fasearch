"use client";
import { useEffect, useRef, useState } from "react";
import { returnApi, refundMethodLabel, refundStatus, returnMoney, returnReasons, returnStatuses, type CustomerReturns } from "@/lib/return-client";
import ac from "@/components/account/account-cards.module.css";
import "./returns.css";

type Item = { skuId: number; productName: string; quantity: number };
export function ReturnSection({ orderId, items, status, refundMethod }: { orderId: number; items: Item[]; status: string; refundMethod: string | null }) {
  const picker = useRef<HTMLInputElement>(null);
  const [data, setData] = useState<CustomerReturns | null>(null);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);
  const [quantities, setQuantities] = useState<Record<number, number>>({});
  const [reason, setReason] = useState("WRONG_SIZE");
  const [note, setNote] = useState("");
  const [photos, setPhotos] = useState<{ contentType: string; data: string; name: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const [requestId, setRequestId] = useState("");
  const [sent, setSent] = useState(false);
  useEffect(() => {
    if (!["COMPLETED", "RETURNED"].includes(status)) return;
    const controller = new AbortController();
    returnApi<CustomerReturns>(`/api/customer-commerce/returns/orders/${orderId}`, undefined, controller.signal).then(setData).catch(e => { if (!controller.signal.aborted) setError(e.message); });
    return () => controller.abort();
  }, [orderId, status]);
  if (!["COMPLETED", "RETURNED"].includes(status)) return null;
  async function choosePhotos(files: FileList | null) {
    setError("");
    if (!files) return;
    if (files.length + photos.length > 3 || [...files].some(f => !["image/png", "image/jpeg"].includes(f.type) || f.size > 5 * 1024 * 1024)) { setError("Chọn tối đa 3 ảnh PNG/JPG, mỗi ảnh không quá 5MB."); return; }
    try {
      const result = await Promise.all([...files].map(file => new Promise<{ contentType: string; data: string; name: string }>((resolve, reject) => {
        const reader = new FileReader(); reader.onerror = () => reject(new Error("Không đọc được ảnh."));
        reader.onload = () => resolve({ name: file.name, contentType: file.type, data: String(reader.result).split(",")[1] }); reader.readAsDataURL(file);
      })));
      setPhotos(current => [...current, ...result]);
    } catch (e) { setError(e instanceof Error ? e.message : "Không đọc được ảnh."); }
  }
  async function submit(event: React.FormEvent) {
    event.preventDefault(); if (busy) return;
    const lines = Object.entries(quantities).filter(([, quantity]) => quantity > 0).map(([skuId, quantity]) => ({ skuId: Number(skuId), quantity }));
    if (!lines.length) { setError("Chọn ít nhất một sản phẩm cần đổi/trả."); return; }
    setBusy(true); setError("");
    try {
      await returnApi("/api/customer-commerce/returns", { orderId, requestId, reason, note, lines, photos: photos.map(({ contentType, data }) => ({ contentType, data })) });
      setOpen(false); setSent(true);
      setData(await returnApi<CustomerReturns>(`/api/customer-commerce/returns/orders/${orderId}`));
    } catch (e) { setError(e instanceof Error ? e.message : "Không gửi được yêu cầu."); }
    finally { setBusy(false); }
  }
  return <section className={`${ac.card} sfReturns`} aria-labelledby="return-title">
    <div className={ac.head}><p className={ac.eyebrow}>Đổi/trả</p><h2 id="return-title" className={ac.title}>Yêu cầu đổi/trả</h2>
      <p className={ac.lead}>Gửi yêu cầu trong {data?.windowDays ?? 7} ngày kể từ khi hoàn tất đơn. Stripe được hoàn tự động; các phương thức khác được cửa hàng hoàn thủ công.</p>
      {data && data.refundedAmount > 0 ? <p className={ac.lead}><strong>{refundStatus(data.refundedAmount, data.paidAmount)}</strong> · Đã hoàn {returnMoney(data.refundedAmount)} / Đã trả {returnMoney(data.paidAmount)}</p> : null}
      {data?.partiallyReturned ? <span className={`${ac.chip} sfReturnPartial`}>Đã trả một phần</span> : null}
    </div>
    {error ? <p className={ac.alert} role="alert">{error}</p> : null}
    {sent ? <p role="status" className={ac.meta}>Đã gửi yêu cầu. Cửa hàng sẽ kiểm tra và phản hồi tại đây.</p> : null}
    {!data && !error ? <p role="status">Đang tải thông tin đổi/trả…</p> : null}
    {data?.eligible && !open ? <button type="button" className={ac.secondary} onClick={() => { setOpen(true); setError(""); setRequestId(crypto.randomUUID()); }}>Yêu cầu đổi/trả</button> : null}
    {data && !data.eligible && data.requests.length === 0 ? <p className={ac.meta}>{data.completedAt ? "Đơn đã hết thời hạn đổi/trả." : "Chưa có thời điểm hoàn tất để xác định thời hạn. Vui lòng liên hệ cửa hàng."}</p> : null}
    {open ? <form onSubmit={submit} className="sfReturnForm"><fieldset disabled={busy}>
      <legend>Chọn sản phẩm và số lượng</legend>
      <p>Phương thức hoàn: {refundMethodLabel(refundMethod)}</p>
      {items.map(item => { const max = data?.lines.find(l => l.skuId === item.skuId)?.remaining ?? 0;
        return <label className="sfReturnLine" key={item.skuId}><span>{item.productName}<small>SKU {item.skuId} · Còn có thể trả: {max}</small></span><input className={ac.input} type="number" aria-label={`Số lượng trả SKU ${item.skuId}`} min={0} max={max} value={quantities[item.skuId] ?? 0} disabled={max === 0 || busy} onChange={e => setQuantities({ ...quantities, [item.skuId]: Number(e.target.value) })} /></label>;
      })}
      <label className={ac.field}>Lý do<select aria-label="Lý do" className={ac.input} value={reason} onChange={e => setReason(e.target.value)}>{Object.entries(returnReasons).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
      <label className={ac.field}>Ghi chú{reason === "OTHER" ? " (bắt buộc)" : ""}<textarea aria-label="Ghi chú" className={ac.input} value={note} required={reason === "OTHER"} maxLength={1000} onChange={e => setNote(e.target.value)} /></label>
      <div className={ac.field}><span>Ảnh minh chứng (tối đa 3 ảnh PNG/JPG, 5MB/ảnh)</span><input ref={picker} type="file" hidden aria-label="Chọn ảnh minh chứng" accept="image/png,image/jpeg" multiple onChange={e => { void choosePhotos(e.target.files); e.target.value = ""; }} /><button type="button" className={ac.secondary} disabled={photos.length >= 3} onClick={() => picker.current?.click()}>Chọn ảnh</button></div>
      {photos.length ? <ul className="sfReturnFiles">{photos.map((p, i) => <li key={`${p.name}-${i}`}><span>{p.name}</span><button className={ac.secondary} type="button" aria-label={`Xóa ảnh ${p.name}`} onClick={() => setPhotos(current => current.filter((_, index) => index !== i))}>Xóa</button></li>)}</ul> : <p className={ac.meta}>Chưa chọn ảnh</p>}
      <p className={ac.meta}>Tiền hoàn được tính từ giá thực trả sau Voucher và điểm. Phí giao hàng chỉ được hoàn một lần khi sản phẩm lỗi hoặc không giống mô tả. Chọn hàng để cửa hàng xem xét hoàn tiền sau khi nhận lại.</p>
      <div className={ac.actions}><button className={ac.primary} type="submit">{busy ? "Đang gửi…" : "Gửi yêu cầu"}</button><button className={ac.secondary} type="button" onClick={() => setOpen(false)}>Đóng</button></div>
    </fieldset></form> : null}
    {data?.requests.map(r => <article className="sfReturnHistory" key={r.id}><h3>Yêu cầu #{r.id} · {returnStatuses[r.status]}</h3><p>{returnReasons[r.reason]}{r.note ? ` · ${r.note}` : ""}</p>
      <ul>{r.lines.map(l => <li key={l.skuId}>{l.productName} × {l.quantity} · {returnMoney(l.refundAmount)}</li>)}</ul>
      <p>Tiền hàng: {returnMoney(r.merchandiseAmount)} · Phí giao hàng: {returnMoney(r.shippingAmount)}</p><p><strong>{r.status === "REFUNDED" ? "Đã hoàn" : "Dự kiến hoàn"}: {returnMoney(r.refundAmount)}</strong> · {refundMethodLabel(r.refundMethod)}</p>
      {r.cancelReason ? <p className={ac.alert}>Lý do hủy: {r.cancelReason}</p> : null}
      {r.rejectionReason ? <p className={ac.alert}>Lý do từ chối: {r.rejectionReason}</p> : null}
      {r.status === "REFUNDED" ? <p>Đã hoàn {returnMoney(r.refundAmount)} · Thu hồi {r.earnedReverse} điểm (thiếu {r.pointsShortfall}) · Hoàn lại {r.redeemedReturn} điểm đã đổi.</p> : null}
      <ol>{r.history.map((h, i) => <li key={i}>{new Date(h.occurredAt).toLocaleString("vi-VN")} · {returnStatuses[h.status]}{h.note ? ` · ${h.note}` : ""}</li>)}</ol>
    </article>)}
  </section>;
}
