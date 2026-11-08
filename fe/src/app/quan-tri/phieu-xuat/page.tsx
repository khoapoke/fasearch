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
import { useAdminCan } from "@/components/admin-b/use-admin-role";
import { getExportPage, type ExportSummary } from "@/lib/admin-export-client";
import { formatDateTime } from "@/lib/admin-format";
const TYPE: Record<string, string> = { DAMAGED: "Hàng hỏng", OTHER: "Xuất khác", TRANSFER: "Chuyển kho" };
const STATUS: Record<string, string> = { COMPLETED: "Hoàn tất", DRAFT: "Draft", CANCELLED: "Đã hủy" };
export default function ExportListPage() {
  const can = useAdminCan();
  const [code, setCode] = useState("");
  const [type, setType] = useState("");
  const list = useFilteredPage<ExportSummary>((q) => getExportPage(q), { receiptCode: code, exportType: type }, "Không tải được phiếu xuất.");
  const rows = list.data?.content ?? [];
  const filtered = Boolean(code.trim() || type);
  return <AdminShellB active="exports" title="Phiếu xuất">
    <PageHeader title="Phiếu xuất" hint={`Chỉ tạo phiếu hàng hỏng hoặc xuất khác. Phiếu hoàn tất trừ tồn kho ngay, không cần duyệt. Một số phiếu cũ chưa có danh sách dòng hàng.${can("INVENTORY_RECEIPT_CREATE") ? "" : " Tài khoản hiện tại chỉ đọc."}`}
      actions={can("INVENTORY_RECEIPT_CREATE") ? <Link className="primary" href="/quan-tri/phieu-xuat/moi">Tạo phiếu xuất</Link> : null} />
    <form className="orders-filters l3-filters" role="search" onSubmit={(e) => e.preventDefault()}>
      <div className="catalog-field"><label className="sr-only" htmlFor="ex-code">Mã phiếu</label><input id="ex-code" className="catalog-input" value={code} onChange={(e) => setCode(e.target.value)} placeholder="Tìm mã phiếu" /></div>
      <div className="catalog-field l3-select"><label htmlFor="ex-type">Loại xuất</label><select id="ex-type" className="catalog-input" value={type} onChange={(e) => setType(e.target.value)}><option value="">Mọi loại xuất</option><option value="DAMAGED">Hàng hỏng</option><option value="OTHER">Xuất khác</option></select></div>
      {filtered ? <button className="secondary" type="button" onClick={() => { setCode(""); setType(""); }}>Đặt lại</button> : null}
    </form>
    {list.error ? <div className="order-empty" role="alert"><strong>Không tải được phiếu xuất</strong><p>{list.error}</p><button className="secondary" type="button" onClick={list.reload}>Thử lại</button></div> : null}
    {list.loading && !list.data ? <TableSkeleton rows={10} columns={6} /> : null}
    {!list.loading && !list.error && list.data && rows.length === 0 ? <div className="order-empty"><strong>{filtered ? "Không có phiếu khớp" : "Chưa có phiếu xuất"}</strong><p>{filtered ? "Thử bỏ bớt bộ lọc." : can("INVENTORY_RECEIPT_CREATE") ? "Tạo phiếu đầu tiên để trừ tồn kho." : "Chưa có phiếu nào."}</p></div> : null}
    {rows.length > 0 ? <div className="table-scroll sticky-head review-table-scroll table-cards" tabIndex={0} aria-label="Danh sách phiếu xuất" aria-busy={list.loading}><table className="review-orders-table l3-table"><caption className="sr-only">Phiếu xuất kho</caption><thead><tr><th>Mã phiếu</th><th>Loại xuất</th><th>Ngày tạo</th><th>Trạng thái</th><th className="num">Mặt hàng</th><th className="num">Số lượng</th></tr></thead><tbody>{rows.map((r) => <RowLink key={r.receiptId} href={`/quan-tri/phieu-xuat/${r.receiptId}`}>
      <td data-label="Mã phiếu" className="cell-title"><Link className="text-link" href={`/quan-tri/phieu-xuat/${r.receiptId}`}>{r.receiptCode}</Link></td>
      <td data-label="Loại xuất">{TYPE[r.exportType] ?? r.exportType}</td>
      <td data-label="Ngày tạo" className="tabnum">{formatDateTime(r.createdAt)}</td>
      <td data-label="Trạng thái"><StatusBadge status={r.status} label={STATUS[r.status] ?? r.status} /></td>
      <td data-label="Mặt hàng" className="num"><Num tone="blue" value={r.totalItems} /></td>
      <td data-label="Số lượng" className="num"><Num tone="orange" bold value={r.totalQuantity} /></td>
    </RowLink>)}</tbody></table></div> : null}
    {list.data && rows.length > 0 ? <Pager page={list.page} totalPages={list.data.totalPages} total={list.data.totalElements} unit="phiếu" busy={list.loading} onPage={list.setPage} /> : null}
  </AdminShellB>;
}
