"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { AdminShellB } from "@/components/admin-b/admin-shell";
import { AdminModal } from "@/components/admin-b/modal";
import { ConfirmDialog } from "@/components/admin-b/confirm-dialog";
import { PageHeader } from "@/components/admin-b/page-header";
import { StatusBadge, Num } from "@/components/admin-b/status-badge";
import { TableSkeleton } from "@/components/admin-b/skeleton";
import { useAdminCan } from "@/components/admin-b/use-admin-role";
import { useToast } from "@/components/admin-b/toast";
import { formatDateTime } from "@/lib/admin-format";
import { returnApi, refundMethodLabel, returnActionError, returnMoney, returnReasons, returnStatuses, type ReturnDetail } from "@/lib/return-client";
import "@/components/admin-b/r1.css";

type ReturnPage = { content: ReturnDetail[]; counts: { status: string; count: number }[]; totalElements: number; totalPages: number };
const tones = { PENDING: "amber", APPROVED: "blue", RECEIVED: "violet", REFUNDED: "green", REJECTED: "red", CANCELLED: "gray" } as const;
export default function ReturnsPage() {
  const can = useAdminCan(); const toast = useToast();
  const [data, setData] = useState<ReturnPage | null>(null);
  const [status, setStatus] = useState(""); const [q, setQ] = useState("");
  const [from, setFrom] = useState(""); const [to, setTo] = useState(""); const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true); const [error, setError] = useState("");
  const [selected, setSelected] = useState<ReturnDetail | null>(null);
  const [note, setNote] = useState(""); const [restock, setRestock] = useState<Record<number, number>>({});
  const [confirm, setConfirm] = useState(""); const [busy, setBusy] = useState(false); const [actionError, setActionError] = useState("");
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("returnId");
    if (!id || !/^[1-9][0-9]*$/.test(id)) return;
    const controller = new AbortController();
    returnApi<ReturnDetail>(`/api/admin/returns/${id}`, undefined, controller.signal)
      .then((detail) => { setSelected(detail); setRestock(Object.fromEntries(detail.lines.map((line) => [line.skuId, line.quantity]))); })
      .catch((e) => { if (!controller.signal.aborted) setError(e instanceof Error ? e.message : "Không tải được yêu cầu đổi/trả."); });
    return () => controller.abort();
  }, []);
  const load = useCallback(async (signal?: AbortSignal) => {
    try {
      setLoading(true);
      const params = new URLSearchParams({ status, q, from, to, page: String(page), size: "20" });
      setData(await returnApi<ReturnPage>(`/api/admin/returns?${params}`, undefined, signal)); setError("");
    } catch (e) { if (!signal?.aborted) setError(e instanceof Error ? e.message : "Không tải được yêu cầu."); }
    finally { if (!signal?.aborted) setLoading(false); }
  }, [status, q, from, to, page]);
  const show = useCallback(async (id: number) => {
    try {
      const detail = await returnApi<ReturnDetail>(`/api/admin/returns/${id}`);
      setSelected(detail); setRestock(Object.fromEntries(detail.lines.map(l => [l.skuId, l.restockQuantity ?? l.quantity]))); setNote(""); setActionError("");
    } catch (e) { toast.error(e instanceof Error ? e.message : "Không tải được chi tiết."); }
  }, [toast]);
  useEffect(() => { const c = new AbortController(); const timer = setTimeout(() => void load(c.signal), 220); return () => { clearTimeout(timer); c.abort(); }; }, [load]);
  useEffect(() => { const params = new URLSearchParams(window.location.search); const id = params.get("id"); const timer = setTimeout(() => { if (params.has("q")) setQ(params.get("q") ?? ""); if (id && /^\d+$/.test(id)) void show(Number(id)); }, 0); return () => clearTimeout(timer); }, [show]);
  async function act() {
    if (!selected || busy) return;
    const invalid = returnActionError(confirm, note, selected.refundMethod);
    if (invalid) { setActionError(invalid); return; }
    setBusy(true); setActionError("");
    try {
      const body = confirm === "receive" ? { lines: selected.lines.map(l => ({ skuId: l.skuId, restockQuantity: restock[l.skuId] ?? l.quantity })) } : confirm === "refund" ? { note } : { action: confirm === "approve" ? "APPROVE" : confirm === "cancel" ? "CANCEL" : "REJECT", note };
      const action = ["approve", "reject", "cancel"].includes(confirm) ? "decision" : confirm;
      await returnApi<ReturnDetail>(`/api/admin/returns/${selected.id}/${action}`, body);
      await show(selected.id);
      setConfirm(""); setNote(""); toast.success("Đã cập nhật yêu cầu đổi/trả."); await load();
    } catch (e) { const message = e instanceof Error ? e.message : "Không xử lý được yêu cầu."; setActionError(message); toast.error(message); if (confirm === "refund") { const detail = await returnApi<ReturnDetail>(`/api/admin/returns/${selected.id}`).catch(() => null); if (detail) setSelected(detail); } }
    finally { setBusy(false); }
  }
  return <AdminShellB title="Đổi/trả">
    <div className="r1"><PageHeader title="Đổi/trả" hint="Tiền hoàn dựa trên giá thực trả sau Voucher và điểm. Phí giao hàng được hoàn một lần khi sản phẩm lỗi hoặc không giống mô tả." />
      <div className="r1-pills" aria-label="Lọc trạng thái">{[["", "Tất cả"], ...Object.entries(returnStatuses)].map(([key, label]) => <button className={status === key ? "active" : ""} type="button" key={key} onClick={() => { setStatus(key); setPage(0); }} aria-pressed={status === key}>{label} <span>{key ? data?.counts.find(c => c.status === key)?.count ?? 0 : data?.counts.reduce((n, c) => n + Number(c.count), 0) ?? 0}</span></button>)}</div>
      <div className="r1-filters"><label>Tìm kiếm<input type="search" placeholder="Mã đơn, khách hàng, số điện thoại" value={q} onChange={e => { setQ(e.target.value); setPage(0); }} /></label><label>Từ ngày<input type="date" value={from} max={to || undefined} onChange={e => { setFrom(e.target.value); setPage(0); }} /></label><label>Đến ngày<input type="date" value={to} min={from || undefined} onChange={e => { setTo(e.target.value); setPage(0); }} /></label></div>
      {error ? <div role="alert" className="r1-error">{error}<button type="button" onClick={() => void load()}>Thử lại</button></div> : null}
      {loading ? <TableSkeleton rows={6} columns={6} /> : <div className="table-scroll"><table className="r1-table"><thead><tr><th>Yêu cầu / Đơn hàng</th><th>Khách hàng</th><th>Lý do</th><th>Tiền hoàn</th><th>Trạng thái</th><th>Ngày gửi</th></tr></thead><tbody>{data?.content.map(r => <tr key={r.id}><td><button className="text-link" onClick={() => void show(r.id)}>#{r.id} · {r.orderCode}</button></td><td><strong>{r.customerName}</strong><small>{r.customerPhone}</small></td><td>{returnReasons[r.reason]}</td><td><Num value={r.refundAmount} money tone="red" /></td><td><StatusBadge status={r.status} tone={tones[r.status as keyof typeof tones]} label={returnStatuses[r.status]} /></td><td>{formatDateTime(r.createdAt)}</td></tr>)}</tbody></table>{!data?.content.length ? <p className="r1-empty">Chưa có yêu cầu đổi/trả phù hợp.</p> : null}</div>}
      <div className="r1-pager"><span>{data?.totalElements ?? 0} yêu cầu</span><button type="button" disabled={page === 0 || loading} onClick={() => setPage(page - 1)}>Trước</button><span>{page + 1} / {Math.max(1, data?.totalPages ?? 1)}</span><button type="button" disabled={loading || page + 1 >= (data?.totalPages ?? 0)} onClick={() => setPage(page + 1)}>Sau</button></div>
    </div>
    <AdminModal open={!!selected} title={selected ? `Đổi/trả #${selected.id} · ${selected.orderCode}` : "Đổi/trả"} size="lg" busy={busy} onClose={() => { setSelected(null); setConfirm(""); }} footer={selected ? <div className="r1-actions">
      {selected.status === "PENDING" && can("RETURN_PROCESS") ? <><button className="danger" type="button" onClick={() => { setConfirm("reject"); setActionError(""); }}>Từ chối</button><button className="primary" type="button" onClick={() => { setConfirm("approve"); setActionError(""); }}>Duyệt</button></> : null}
      {selected.status === "APPROVED" && can("RETURN_PROCESS") ? <><button className="danger" type="button" onClick={() => { setConfirm("cancel"); setActionError(""); }}>Hủy yêu cầu</button><button className="primary" type="button" onClick={() => { setConfirm("receive"); setActionError(""); }}>Đã nhận hàng</button></> : null}
      {selected.status === "RECEIVED" && can("RETURN_REFUND") ? <button className="primary" type="button" onClick={() => { setConfirm("refund"); setActionError(""); }}>{selected.refundAttempts?.some(a => ["failed", "canceled"].includes(a.status)) ? "Stripe từ chối hoàn tiền, thử lại" : "Hoàn tiền"}</button> : null}
      {selected.status === "RECEIVED" && !can("RETURN_REFUND") ? <span className="meta">Cần quyền hoàn tiền để thực hiện bước tiếp theo.</span> : null}
    </div> : undefined}>
      {selected ? <div className="r1 r1-detail"><div className="r1-detail-top"><div><strong>{selected.customerName}</strong><p>{selected.customerPhone}</p><Link className="text-link" href={`/quan-tri/don-hang/${selected.orderId}`}>Xem đơn {selected.orderCode} →</Link></div><StatusBadge status={selected.status} tone={tones[selected.status as keyof typeof tones]} label={returnStatuses[selected.status]} /></div>
        <div className="r1-reason"><strong>{returnReasons[selected.reason]}</strong>{selected.note ? <p>{selected.note}</p> : null}{selected.cancelReason ? <p className="r1-error">Lý do hủy: {selected.cancelReason}</p> : null}{selected.rejectionReason ? <p className="r1-error">Lý do từ chối: {selected.rejectionReason}</p> : null}</div>
        <div className="table-scroll"><table className="r1-table"><thead><tr><th>Sản phẩm</th><th>SL</th><th>Giá trước giảm</th><th>Voucher / Điểm</th><th>Tiền hoàn</th>{selected.status === "APPROVED" || selected.status === "RECEIVED" || selected.status === "REFUNDED" ? <th>Nhập lại / Hỏng</th> : null}</tr></thead><tbody>{selected.lines.map(l => <tr key={l.skuId}><td><strong>{l.productName}</strong><small>SKU {l.skuId} · {l.variantName}</small></td><td>{l.quantity}</td><td>{returnMoney(l.grossAmount)}</td><td>{returnMoney(l.voucherDiscount)}<small>{returnMoney(l.pointsDiscount)}</small></td><td><Num value={l.refundAmount} money tone="red" /></td>{selected.status === "APPROVED" || l.restockQuantity !== null ? <td>{selected.status === "APPROVED" ? <label className="r1-restock">Nhập lại<input aria-label={`Nhập lại SKU ${l.skuId}`} type="number" min={0} max={l.quantity} disabled={!can("RETURN_PROCESS")} value={restock[l.skuId] ?? l.quantity} onChange={e => setRestock({ ...restock, [l.skuId]: Number(e.target.value) })} /><small>Hỏng: {l.quantity - (restock[l.skuId] ?? l.quantity)}</small></label> : `${l.restockQuantity ?? 0} / ${l.quantity - (l.restockQuantity ?? 0)}`}</td> : null}</tr>)}</tbody></table></div>
        <div className="r1-summary"><div><span>Tiền hàng thực trả</span><strong>{returnMoney(selected.merchandiseAmount)}</strong></div><div><span>Phí giao hàng hoàn lại</span><strong>{returnMoney(selected.shippingAmount)}</strong></div><div><span>Tổng hoàn · {refundMethodLabel(selected.refundMethod)}</span><Num value={selected.refundAmount} money tone="red" bold /></div></div>
        {selected.photos.length ? <div className="r1-photos">{selected.photos.map(pos => <a key={pos} href={`/api/admin/returns/${selected.id}/photos/${pos}`} target="_blank" rel="noreferrer">{ /* Photo evidence is served through the authenticated BFF. */ }
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`/api/admin/returns/${selected.id}/photos/${pos}`} alt={`Ảnh minh chứng ${pos + 1}`} /></a>)}</div> : null}
        {selected.status === "REFUNDED" ? <div className="r1-reason"><strong>Mã hoàn: {selected.refundId}</strong><p>{selected.refundActor} · {selected.refundNote}</p><p>Thu hồi {selected.earnedReverse} điểm · Thiếu {selected.pointsShortfall} điểm · Hoàn {selected.redeemedReturn} điểm đã đổi.</p></div> : null}
        {selected.refundAttempts?.length ? <div className="r1-reason"><h3>Lần thử hoàn Stripe</h3><ul>{selected.refundAttempts.map(a => <li key={a.number}>Lần {a.number} · {a.refundId ?? "Chưa có mã"} · {a.status === "succeeded" ? "Thành công" : ["failed", "canceled"].includes(a.status) ? "Stripe từ chối hoàn tiền, thử lại" : "Chờ đối soát"}</li>)}</ul></div> : null}
        <h3>Lịch sử xử lý</h3><ol className="r1-history">{selected.history.map((h, i) => <li key={i}><strong>{returnStatuses[h.status]}</strong><span>{formatDateTime(h.occurredAt)} · {h.actor}</span>{h.note ? <p>{h.note}</p> : null}</li>)}</ol>
      </div> : null}
    </AdminModal>
    <ConfirmDialog open={!!confirm} title={{ approve: "Duyệt yêu cầu đổi/trả", reject: "Từ chối yêu cầu", cancel: "Hủy yêu cầu đã duyệt", receive: "Xác nhận đã nhận hàng", refund: "Xác nhận hoàn tiền" }[confirm] ?? "Xác nhận"} message={confirm === "refund" ? `Hoàn ${returnMoney(selected?.refundAmount ?? 0)} ${selected?.refundMethod === "STRIPE" ? "về thẻ qua Stripe" : "cho khách bằng hình thức hoàn thủ công qua cửa hàng"}. Tiền hàng ${returnMoney(selected?.merchandiseAmount ?? 0)}, phí giao hàng ${returnMoney(selected?.shippingAmount ?? 0)}.` : confirm === "receive" ? "Hàng nhập lại sẽ tăng kho bán được. Hàng hỏng được ghi phiếu DAMAGED, không tăng kho bán được." : "Kiểm tra thông tin trước khi xác nhận."} confirmLabel={confirm === "refund" ? "Xác nhận hoàn tiền" : "Xác nhận"} tone={["reject", "cancel"].includes(confirm) ? "danger" : "primary"} busy={busy} error={actionError} onClose={() => setConfirm("")} onConfirm={() => void act()}>
      {confirm === "receive" ? <ul className="r1-confirm-lines">{selected?.lines.map(l => <li key={l.skuId}>{l.productName}: nhập lại {restock[l.skuId] ?? l.quantity}, hỏng {l.quantity - (restock[l.skuId] ?? l.quantity)}</li>)}</ul> : <label className="r1-note">{confirm === "reject" ? "Lý do từ chối (bắt buộc)" : confirm === "cancel" ? "Lý do hủy yêu cầu (bắt buộc)" : confirm === "refund" && selected?.refundMethod !== "STRIPE" ? "Ghi chú chứng từ hoàn tiền (bắt buộc)" : "Ghi chú"}<textarea value={note} maxLength={1000} disabled={busy} onChange={e => setNote(e.target.value)} /></label>}
    </ConfirmDialog>
  </AdminShellB>;
}
