"use client";
import Link from "next/link";
import { useState } from "react";
import { AdminShellB } from "@/components/admin-b/admin-shell";
import { PageHeader } from "@/components/admin-b/page-header";
import { Pager } from "@/components/admin-b/pagination";
import { RowLink } from "@/components/admin-b/row-link";
import { TableSkeleton } from "@/components/admin-b/skeleton";
import { Num, StatusBadge } from "@/components/admin-b/status-badge";
import { useFilteredPage } from "@/components/admin-b/use-filtered-page";
import { formatDateTime } from "@/lib/admin-format";
import { useAdminCan } from "@/components/admin-b/use-admin-role";
import { getStocktakePage, statusLabel, type StocktakeSummary } from "@/lib/admin-stocktake-client";
const STATUS = [["", "Mọi trạng thái"], ["PENDING_APPROVAL", "Chờ duyệt"], ["RECONCILED", "Đã đối soát"], ["CANCELLED", "Đã hủy"]];
export default function StocktakeListPage() {
  const can = useAdminCan();
  const [code, setCode] = useState("");
  const [status, setStatus] = useState("");
  const list = useFilteredPage<StocktakeSummary>((q) => getStocktakePage(q), { stocktakeCode: code, status }, "Không tải được phiếu kiểm kê.");
  const rows = list.data?.content ?? [];
  const canWrite = can("STOCKTAKE_CREATE");
  const filtered = Boolean(code.trim() || status);
  return <AdminShellB active="stocktakes" title="Kiểm kê">
    <PageHeader title="Kiểm kê" hint={`Phiếu ghi nhận số đếm thực tế; tồn kho không tự thay đổi khi ghi nhận kiểm kê.${canWrite ? "" : " Tài khoản hiện tại chỉ đọc."}`}
      actions={canWrite ? <Link className="primary" href="/quan-tri/kiem-ke/moi">Tạo phiếu kiểm kê</Link> : null} />
    <form className="orders-filters l3-filters" role="search" onSubmit={(e) => e.preventDefault()}>
      <div className="catalog-field"><label className="sr-only" htmlFor="st-code">Mã phiếu</label><input id="st-code" className="catalog-input" value={code} onChange={(e) => setCode(e.target.value)} placeholder="Tìm mã phiếu" /></div>
      <div className="catalog-field l3-select"><label htmlFor="st-status">Trạng thái</label><select id="st-status" className="catalog-input" value={status} onChange={(e) => setStatus(e.target.value)}>{STATUS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>
      {filtered ? <button className="secondary" type="button" onClick={() => { setCode(""); setStatus(""); }}>Đặt lại</button> : null}
    </form>
    {list.error ? <div className="order-empty" role="alert"><strong>Không tải được phiếu kiểm kê</strong><p>{list.error}</p><button className="secondary" type="button" onClick={list.reload}>Thử lại</button></div> : null}
    {list.loading && !list.data ? <TableSkeleton rows={8} columns={5} /> : null}
    {!list.loading && !list.error && list.data && rows.length === 0 ? <div className="order-empty"><strong>{filtered ? "Không có phiếu khớp" : "Chưa có phiếu kiểm kê"}</strong><p>{filtered ? "Thử bỏ bớt bộ lọc." : "Ghi nhận số đếm thực tế để tạo phiếu đầu tiên."}</p></div> : null}
    {rows.length > 0 ? <div className="table-scroll sticky-head review-table-scroll table-cards" tabIndex={0} aria-label="Danh sách phiếu kiểm kê" aria-busy={list.loading}><table className="review-orders-table l3-table"><caption className="sr-only">Phiếu kiểm kê</caption><thead><tr><th>Mã phiếu</th><th>Trạng thái</th><th>Ngày tạo</th><th className="num">Số dòng</th><th className="num">Tổng lệch</th></tr></thead><tbody>{rows.map((r) => <RowLink key={r.stocktakeId} href={`/quan-tri/kiem-ke/${r.stocktakeId}`}>
      <td data-label="Mã phiếu" className="cell-title"><Link className="text-link" href={`/quan-tri/kiem-ke/${r.stocktakeId}`}>{r.stocktakeCode}</Link></td>
      <td data-label="Trạng thái"><StatusBadge status={r.status} label={statusLabel(r.status)} /></td>
      <td data-label="Ngày tạo" className="tabnum">{formatDateTime(r.createdAt)}</td>
      <td data-label="Số dòng" className="num"><Num tone="blue" value={r.totalItems} /></td>
      <td data-label="Tổng lệch" className="num"><Num tone="amber" value={r.totalDiscrepancy} /></td>
    </RowLink>)}</tbody></table></div> : null}
    {list.data && rows.length > 0 ? <Pager page={list.page} totalPages={list.data.totalPages} total={list.data.totalElements} unit="phiếu" busy={list.loading} onPage={list.setPage} /> : null}
  </AdminShellB>;
}
