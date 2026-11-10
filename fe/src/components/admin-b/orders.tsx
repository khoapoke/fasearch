"use client";

import "./f5.css";
import "./p1.css";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { AdminShellB } from "./admin-shell";
import { notifyOrdersChanged } from "./admin-frame";
import { ConfirmDialog } from "./confirm-dialog";
import { CsvExportButton } from "./csv-export-button";
import { LiveSearchField } from "./live-search-field";
import { PageHeader } from "./page-header";
import { Pager } from "./pagination";
import { RowLink } from "./row-link";
import { statusToneColor, StatusBadge, Num } from "./status-badge";
import { TableSkeleton } from "./skeleton";
import { useToast } from "./toast";
import { useAdminCan } from "./use-admin-role";
import { useLiveSearch } from "./use-live-search";
import { formatDateTime, formatNumber } from "@/lib/admin-format";
import { orderCsvQuery } from "@/lib/admin-csv";
import { searchUrl } from "@/lib/live-search";
import { eligibleBulkStep, NEXT_STEP, processBulk } from "./order-print-logic";
import { updateOrderStatus, OrderError } from "@/lib/admin-order-client";

type Order = { orderId: number; orderCode: string; status: string; customerName: string | null; customerPhone: string | null; deliveryAddress: string | null; subTotal: number; discountAmount: number; shippingFee: number; totalAmount: number; createdAt: string; paymentStatus: string | null; paymentMethod: string | null };
type Page = { content: Order[]; pageNumber: number; pageSize: number; totalElements: number; totalPages: number; last: boolean };
const STATUS: Record<string, string> = { PENDING: "Mới tạo", CONFIRMED: "Đã xác nhận", PACKING: "Đang đóng gói", SHIPPING: "Đang giao", COMPLETED: "Hoàn thành", CANCELLED: "Đã hủy", RETURNED: "Đã trả lại" };
const FILTERS = [{ v: "", l: "Tất cả" }, ...Object.entries(STATUS).map(([v, l]) => ({ v, l }))];
const date = formatDateTime;
function paidMethodName(method: string | null): string {
  if (method === "STRIPE") return "Stripe";
  if (method === "VNPAY_QR" || method === "VNPAY") return "VNPay";
  if (method === "MOMO") return "MoMo";
  if (method === "BANK_TRANSFER") return "Chuyển khoản";
  if (method === "E_WALLET") return "Ví điện tử";
  if (method === "CASH") return "Tiền mặt";
  return method ?? "";
}
const DAY = /^\d{4}-\d{2}-\d{2}$/;
function dayLabel(value: string): string { const [y, m, d] = value.split("-"); return `${d}/${m}/${y}`; }
function rangeLabel(from: string, to: string): string {
  if (from && to) return from === to ? dayLabel(from) : `${dayLabel(from)} – ${dayLabel(to)}`;
  return from ? `Từ ${dayLabel(from)}` : `Đến ${dayLabel(to)}`;
}
async function fetchCount(status: string, from: string, to: string): Promise<number | null> {
  try {
    const params = new URLSearchParams({ page: "0", size: "1" });
    if (status) params.set("status", status);
    if (from) params.set("startDate", from);
    if (to) params.set("endDate", to);
    const r = await fetch(`/api/admin/orders?${params}`, { cache: "no-store" });
    const j = await r.json();
    return r.ok && j.success ? Number(j.result?.totalElements ?? 0) : null;
  } catch { return null; }
}

export function OrdersClient({
  initialQuery = "",
  initialStatus = "",
  initialFrom = "",
  initialTo = "",
  initialPage = 0,
}: {
  initialQuery?: string;
  initialStatus?: string;
  initialFrom?: string;
  initialTo?: string;
  initialPage?: number;
} = {}) {
  const toast = useToast(); const can = useAdminCan();
  const [status, setStatus] = useState(initialStatus);
  const [from, setFrom] = useState(initialFrom);
  const [to, setTo] = useState(initialTo);
  const [counts, setCounts] = useState<Record<string, number | null>>({});
  const [selection, setSelection] = useState<{ key: string; ids: number[] }>({ key: "", ids: [] });
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkResult, setBulkResult] = useState<{ success: number; errors: string[] } | null>(null);
  const [target, setTarget] = useState<Order | null>(null);
  const [note, setNote] = useState("");
  const [stepOpen, setStepOpen] = useState(false);
  const [acting, setActing] = useState(false);
  const [actError, setActError] = useState("");
  const actingRef = useRef(false);
  const live = useLiveSearch<Page>({
    initialQuery,
    initialPage,
    unit: "đơn",
    filtersKey: `${status}|${from}|${to}`,
    request: (query, page, signal) => {
      const params = new URLSearchParams({ page: String(page), size: "10", sort: "orderDate,desc" });
      if (query) params.set("keyword", query);
      if (status) params.set("status", status);
      if (from) params.set("startDate", from);
      if (to) params.set("endDate", to);
      return fetch(`/api/admin/orders?${params}`, { cache: "no-store", signal })
        .then(async (response) => {
          const payload = await response.json();
          if (!response.ok || !payload.success) throw new Error(payload.message || "Không tải được đơn.");
          return payload.result as Page;
        });
    },
    buildUrl: (query, page) => searchUrl("/quan-tri/don-hang", {
      keyword: query,
      status,
      from,
      to,
      page: page > 0 ? page : null,
    }),
  });

  // The address bar also wins if a cached Back payload carries an older status prop.
  useEffect(() => {
    void Promise.resolve().then(() => {
      const params = new URLSearchParams(window.location.search);
      const nextStatus = params.get("status") ?? "";
      setStatus((current) => (current === nextStatus ? current : nextStatus));
      const nextFrom = params.get("from") ?? ""; const nextTo = params.get("to") ?? "";
      setFrom((current) => { const next = DAY.test(nextFrom) ? nextFrom : ""; return current === next ? current : next; });
      setTo((current) => { const next = DAY.test(nextTo) ? nextTo : ""; return current === next ? current : next; });
    });
  }, []);

  // Same-route navigation passes fresh server props without remounting this component.
  const previousStatus = useRef(initialStatus);
  useEffect(() => {
    if (previousStatus.current === initialStatus) return;
    previousStatus.current = initialStatus;
    void Promise.resolve().then(() => setStatus(initialStatus));
  }, [initialStatus]);
  const previousRange = useRef(`${initialFrom}|${initialTo}`);
  useEffect(() => {
    const key = `${initialFrom}|${initialTo}`;
    if (previousRange.current === key) return;
    previousRange.current = key;
    void Promise.resolve().then(() => { setFrom(initialFrom); setTo(initialTo); });
  }, [initialFrom, initialTo]);

  // Back/Forward restores the status chip; the hook restores the text and page.
  useEffect(() => {
    function onPopState() {
      const params = new URLSearchParams(window.location.search);
      setStatus(params.get("status") ?? "");
      const nextFrom = params.get("from") ?? ""; const nextTo = params.get("to") ?? "";
      setFrom(DAY.test(nextFrom) ? nextFrom : ""); setTo(DAY.test(nextTo) ? nextTo : "");
    }
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  // Returning from an order detail restores the same query, chip and page.
  useEffect(() => {
    try {
      sessionStorage.setItem("admin-orders-return", searchUrl("/quan-tri/don-hang", {
        keyword: live.term,
        status,
        from,
        to,
        page: live.page > 0 ? live.page : null,
      }));
    } catch { /* SSR/no-storage */ }
  }, [live.term, live.page, status, from, to]);

  function reset() {
    setStatus("");
    setFrom(""); setTo("");
    live.clear();
  }

  const refreshCounts = useCallback(() => {
    void Promise.all(FILTERS.map((f) => fetchCount(f.v, from, to).then((n) => [f.v, n] as const))).then((rows) => setCounts(Object.fromEntries(rows)));
  }, [from, to]);
  useEffect(() => { refreshCounts(); }, [refreshCounts]);

  function openStep(order: Order) { setTarget(order); setStepOpen(true); setNote(""); setActError(""); }
  function closeStep() { if (!actingRef.current) setStepOpen(false); }
  async function confirmStep() {
    const step = target ? NEXT_STEP[target.status] : undefined;
    if (!target || !step || actingRef.current) return;
    if (note.length > 1000) { setActError("Ghi chú tối đa 1000 ký tự."); return; }
    actingRef.current = true; setActing(true); setActError("");
    try {
      await updateOrderStatus(String(target.orderId), step.target, note);
      toast.success(`Đơn ${target.orderCode} đã chuyển sang ${STATUS[step.target]}.`);
      setStepOpen(false);
    } catch (failure) {
      if (failure instanceof OrderError) setActError(failure.message);
      else { setStepOpen(false); toast.error("Chưa xác định được trạng thái đơn đã đổi hay chưa. Đã tải lại danh sách để đối soát."); }
    } finally {
      actingRef.current = false; setActing(false);
      notifyOrdersChanged(); refreshCounts(); live.reload();
    }
  }
  const step = target ? NEXT_STEP[target.status] : undefined;
  const selectionKey = `${live.term}|${status}|${from}|${to}|${live.page}`;
  const ids = selection.key === selectionKey ? selection.ids : [];
  const selected = (live.data?.content ?? []).filter((order) => ids.includes(order.orderId));
  const bulkStep = eligibleBulkStep(selected);
  const setIds = (next: number[]) => setSelection({ key: selectionKey, ids: next });
  async function runBulk() {
    if (!bulkStep || actingRef.current || !can("ORDER_UPDATE_STATUS")) return;
    actingRef.current = true; setActing(true);
    const result = await processBulk(selected, (order) => updateOrderStatus(String(order.orderId), bulkStep.target, ""), (order, error) => `${order.orderCode}: ${error instanceof OrderError ? error.message : "Chưa xác định được kết quả; đối soát đơn trước khi thử lại."}`);
    setBulkResult(result); setBulkOpen(false); setIds([]);
    actingRef.current = false; setActing(false); notifyOrdersChanged(); refreshCounts(); live.reload();
  }
  const printUrl = (type: string) => `/quan-tri/don-hang/in?ids=${selected.map((order) => order.orderId).join(",")}&type=${type}`;

  return <AdminShellB active="orders" title="Đơn hàng">
    <PageHeader title="Đơn hàng" actions={<CsvExportButton dataset="orders" query={orderCsvQuery({ keyword: live.term, status, from, to })} confirm />} />
    <form className="orders-filters" onSubmit={(e) => { e.preventDefault(); live.searchNow(); }} aria-label="Bộ lọc đơn hàng">
      <LiveSearchField
        id="admin-order-search"
        label="Tìm đơn"
        placeholder="Mã đơn, SĐT, khách"
        input={live.inputProps}
        onClear={live.clear}
        showClear={live.typed.length > 0}
      />
      <div className="status-pills" role="group" aria-label="Lọc trạng thái">{FILTERS.map((f) => {
        const tone = f.v ? statusToneColor(f.v) : null;
        const count = counts[f.v];
        return <button key={f.v || "all"} className={`status-pill${status === f.v ? " active" : ""}`} type="button" aria-pressed={status === f.v} onClick={() => { setStatus(f.v); live.searchNow(); }}>
          <span className={`pill-dot${tone ? ` t-${tone}` : ""}`} aria-hidden="true" />{f.l}{count !== undefined && count !== null ? <span className="pill-count">{formatNumber(count)}</span> : null}
        </button>;
      })}</div>
      {from || to ? <span className="status-pill active range-chip" role="group" aria-label={`Khoảng ngày tạo ${rangeLabel(from, to)}`}>Ngày tạo: {rangeLabel(from, to)}<button type="button" className="range-chip-x" aria-label="Bỏ lọc ngày" onClick={() => { setFrom(""); setTo(""); live.searchNow(); }}>×</button></span> : null}
      {status || from || to || live.typed ? <button className="secondary btn-sm" type="button" onClick={reset}>Đặt lại</button> : null}
    </form>
    <p className="sr-only" role="status" aria-live="polite">{live.statusText}</p>
    {live.error ? <div className="order-empty" role="alert"><strong>Không tải được đơn</strong><p>{live.error}</p><button className="secondary" type="button" onClick={live.reload}>Thử lại</button></div> : null}
    {live.loading && !live.data ? <TableSkeleton rows={10} columns={7} rowHeight={44} /> : null}
    {!live.loading && !live.error && live.data?.content.length === 0 ? <div className="order-empty"><strong>Không có đơn khớp</strong><p>{live.term ? `Không tìm thấy đơn cho “${live.term}”. Thử từ khóa khác.` : "Thử bỏ lọc hoặc chọn trạng thái hoặc khoảng ngày khác."}</p></div> : null}
    {live.data && live.data.content.length > 0 ? <div className="table-scroll sticky-head review-table-scroll table-cards" tabIndex={0} aria-label="Danh sách đơn hàng" aria-busy={live.loading}><table className="review-orders-table fit-table"><thead><tr><th><input type="checkbox" aria-label="Chọn tất cả trang này" checked={selected.length > 0 && selected.length === live.data.content.length} onChange={(e) => setIds(e.target.checked ? live.data!.content.map((order) => order.orderId) : [])} /></th><th>Mã đơn</th><th>Khách</th><th>Ngày tạo</th><th>Trạng thái</th><th>Thanh toán</th><th className="num">Tổng</th><th className="num">Thao tác</th></tr></thead><tbody>{live.data.content.map((o) => {
      const paid = o.paymentStatus === "PAID";
      const next = NEXT_STEP[o.status];
      const needsCash = o.status === "SHIPPING" && !paid;
      const method = paidMethodName(o.paymentMethod);
      return <RowLink key={o.orderId} href={`/quan-tri/don-hang/${o.orderId}`}>
        <td data-label="Chọn"><input type="checkbox" aria-label={`Chọn đơn ${o.orderCode}`} checked={ids.includes(o.orderId)} onChange={(e) => setIds(e.target.checked ? [...ids, o.orderId] : ids.filter((id) => id !== o.orderId))} /></td>
        <td data-label="Mã đơn"><Link className="order-code" href={`/quan-tri/don-hang/${o.orderId}`}>{o.orderCode}</Link></td>
        <td data-label="Khách"><span className="cell-main">{o.customerName ?? <span className="empty-value">Chưa có tên</span>}</span>{o.customerPhone ? <small className="cell-sub">{o.customerPhone}</small> : null}</td>
        <td data-label="Ngày tạo" className="cell-date">{date(o.createdAt)}</td>
        <td data-label="Trạng thái"><StatusBadge status={o.status} label={STATUS[o.status] ?? o.status} /></td>
        <td data-label="Thanh toán">{paid ? <><StatusBadge status="PAID" label="Đã thanh toán" />{method ? <small className="cell-sub">{method}</small> : null}</> : <StatusBadge status="UNPAID" tone={o.status === "CANCELLED" || o.status === "RETURNED" ? "gray" : undefined} label="Chưa thanh toán" />}</td>
        <td data-label="Tổng" className="num"><Num value={o.totalAmount} money tone={paid ? "green" : "ink"} bold={paid} dimZero={false} /></td>
        <td data-label="Thao tác" className="num row-actions-cell">{next && !needsCash && can("ORDER_UPDATE_STATUS") ? <button className="secondary btn-sm" type="button" onClick={() => openStep(o)}>{next.label}</button> : needsCash && can("ORDER_COLLECT_CASH") ? <Link className="secondary btn-sm" href={`/quan-tri/don-hang/${o.orderId}`}>Thu tiền</Link> : null}</td>
      </RowLink>;
    })}</tbody></table></div> : null}
    {live.data && live.data.content.length > 0 ? <Pager page={live.page} totalPages={live.data.totalPages} total={live.data.totalElements} unit="đơn" busy={live.loading} onPage={live.goToPage} /> : null}
    {bulkResult ? <div className="p1-result" role="status"><strong>{bulkResult.success} thành công, {bulkResult.errors.length} lỗi</strong>{bulkResult.errors.length ? <ul>{bulkResult.errors.map((error, i) => <li key={i}>{error}</li>)}</ul> : null}<button type="button" className="secondary btn-sm" onClick={() => setBulkResult(null)}>Đóng</button></div> : null}
    {selected.length ? <div className="p1-bulk" role="region" aria-label="Thao tác nhiều đơn"><strong>Đã chọn {selected.length} đơn</strong>{can("ORDER_VIEW") ? <><Link className="secondary btn-sm" href={printUrl("invoice")} target="_blank">In hóa đơn</Link><Link className="secondary btn-sm" href={printUrl("shipping")} target="_blank">In phiếu giao hàng</Link></> : null}{bulkStep && can("ORDER_UPDATE_STATUS") ? <button type="button" className="primary btn-sm" onClick={() => setBulkOpen(true)}>{bulkStep.label}</button> : null}<button type="button" className="secondary btn-sm" onClick={() => setIds([])}>Bỏ chọn</button></div> : null}
    <ConfirmDialog open={bulkOpen && !!bulkStep} title={`${bulkStep?.title ?? "Chuyển trạng thái"}?`} message={`Chuyển ${selected.length} đơn đã chọn sang ${bulkStep ? STATUS[bulkStep.target] : ""}. ${bulkStep?.target === "COMPLETED" ? "Hoàn tất sẽ trừ tồn vật lý và tạm giữ." : ""}`} confirmLabel={bulkStep?.title} busy={acting} onConfirm={() => void runBulk()} onClose={() => setBulkOpen(false)} />
    <ConfirmDialog
      open={stepOpen && !!step}
      title={step ? `${step.title}?` : ""}
      message={target && step ? <>Đơn <strong>{target.orderCode}</strong>: {STATUS[target.status]} → <strong>{STATUS[step.target]}</strong>. {step.target === "COMPLETED" ? "Hoàn tất sẽ trừ tồn vật lý và tạm giữ." : "Bước này không thay đổi tồn kho."}</> : null}
      confirmLabel={step?.title ?? "Xác nhận"}
      busy={acting}
      error={actError}
      onConfirm={() => void confirmStep()}
      onClose={closeStep}
    >
      <div className="catalog-field"><label htmlFor="order-step-note">Ghi chú (không bắt buộc)</label><textarea id="order-step-note" className="catalog-input" rows={3} maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)} disabled={acting} /></div>
    </ConfirmDialog>
  </AdminShellB>;
}
