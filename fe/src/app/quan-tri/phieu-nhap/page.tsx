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
import { getImportPage, type ImportSummary } from "@/lib/admin-stock-client";
import { formatDateTime } from "@/lib/admin-format";
const STATUS: Record<string, string> = { COMPLETED: "Hoàn tất", DRAFT: "Draft", CANCELLED: "Đã hủy" };
export default function ImportListPage() {
  const can = useAdminCan();
  const [receiptCode, setReceiptCode] = useState("");
  const [supplierName, setSupplierName] = useState("");
  const list = useFilteredPage<ImportSummary>((q) => getImportPage(q), { receiptCode, supplierName }, "Không tải được phiếu nhập.");
  const rows = list.data?.content ?? [];
  const filtered = Boolean(receiptCode.trim() || supplierName.trim());
  return <AdminShellB active="imports" title="Phiếu nhập">
    <PageHeader title="Phiếu nhập" hint={`Phiếu hoàn tất cộng tồn kho ngay, không cần duyệt.${can("INVENTORY_RECEIPT_CREATE") ? "" : " Tài khoản hiện tại chỉ đọc."}`}
      actions={can("INVENTORY_RECEIPT_CREATE") ? <Link className="primary" href="/quan-tri/phieu-nhap/moi">Tạo phiếu nhập</Link> : null} />
    <form className="orders-filters l3-filters" role="search" onSubmit={(e) => e.preventDefault()}>
      <div className="catalog-field"><label className="sr-only" htmlFor="im-code">Mã phiếu</label><input id="im-code" className="catalog-input" value={receiptCode} onChange={(e) => setReceiptCode(e.target.value)} placeholder="Tìm mã phiếu" /></div>
      <div className="catalog-field"><label className="sr-only" htmlFor="im-supplier">Nhà cung cấp</label><input id="im-supplier" className="catalog-input" value={supplierName} onChange={(e) => setSupplierName(e.target.value)} placeholder="Tìm nhà cung cấp" /></div>
      {filtered ? <button className="secondary" type="button" onClick={() => { setReceiptCode(""); setSupplierName(""); }}>Đặt lại</button> : null}
    </form>
    {list.error ? <div className="order-empty" role="alert"><strong>Không tải được phiếu</strong><p>{list.error}</p><button className="secondary" type="button" onClick={list.reload}>Thử lại</button></div> : null}
    {list.loading && !list.data ? <TableSkeleton rows={10} columns={7} /> : null}
    {!list.loading && !list.error && list.data && rows.length === 0 ? <div className="order-empty"><strong>{filtered ? "Không có phiếu khớp" : "Chưa có phiếu nhập"}</strong><p>{filtered ? "Thử bỏ bớt bộ lọc." : can("INVENTORY_RECEIPT_CREATE") ? "Tạo phiếu đầu tiên để cộng tồn kho." : "Chưa có phiếu nào."}</p></div> : null}
    {rows.length > 0 ? <div className="table-scroll sticky-head review-table-scroll table-cards" tabIndex={0} aria-label="Danh sách phiếu nhập" aria-busy={list.loading}><table className="review-orders-table l3-table"><caption className="sr-only">Phiếu nhập kho</caption><thead><tr><th>Mã phiếu</th><th>Nhà cung cấp</th><th>Ngày tạo</th><th>Trạng thái</th><th className="num">Mặt hàng</th><th className="num">Số lượng</th><th className="num">Tổng tiền</th></tr></thead><tbody>{rows.map((r) => <RowLink key={r.receiptId} href={`/quan-tri/phieu-nhap/${r.receiptId}`}>
      <td data-label="Mã phiếu" className="cell-title"><Link className="text-link" href={`/quan-tri/phieu-nhap/${r.receiptId}`}>{r.receiptCode}</Link></td>
      <td data-label="Nhà cung cấp">{r.supplierName}</td>
      <td data-label="Ngày tạo" className="tabnum">{formatDateTime(r.createdAt)}</td>
      <td data-label="Trạng thái"><StatusBadge status={r.status} label={STATUS[r.status] ?? r.status} /></td>
      <td data-label="Mặt hàng" className="num"><Num tone="blue" value={r.totalItems} /></td>
      <td data-label="Số lượng" className="num"><Num tone="blue" value={r.totalQuantity} /></td>
      <td data-label="Tổng tiền" className="num"><Num tone="green" bold money value={r.totalAmount} /></td>
    </RowLink>)}</tbody></table></div> : null}
    {list.data && rows.length > 0 ? <Pager page={list.page} totalPages={list.data.totalPages} total={list.data.totalElements} unit="phiếu" busy={list.loading} onPage={list.setPage} /> : null}
  </AdminShellB>;
}
