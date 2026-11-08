"use client";

import Link from "next/link";
import { useState } from "react";
import { AdminShellB } from "@/components/admin-b/admin-shell";
import { AdminModal } from "@/components/admin-b/modal";
import { CsvExportButton } from "@/components/admin-b/csv-export-button";
import { CustomerForm } from "@/components/admin-b/customer-form";
import { LiveSearchField } from "@/components/admin-b/live-search-field";
import { PageHeader } from "@/components/admin-b/page-header";
import { Pager } from "@/components/admin-b/pagination";
import { RowLink } from "@/components/admin-b/row-link";
import { TableSkeleton } from "@/components/admin-b/skeleton";
import { Num } from "@/components/admin-b/status-badge";
import { TierBadge } from "@/components/admin-b/tier";
import { useToast } from "@/components/admin-b/toast";
import { useLiveSearch } from "@/components/admin-b/use-live-search";
import { useAdminCan } from "@/components/admin-b/use-admin-role";
import { customerCsvQuery } from "@/lib/admin-csv";
import { getCustomerPage, genderLabel, type Customer, type Page } from "@/lib/admin-customer-client";
import { searchUrl } from "@/lib/live-search";

const EMPTY = <span className="empty-value">Chưa cập nhật</span>;

export function AdminCustomersClient({ initialKeyword, initialPage }: { initialKeyword: string; initialPage: number }) {
  const can = useAdminCan();
  const toast = useToast();
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);
  const live = useLiveSearch<Page<Customer>>({
    initialQuery: initialKeyword,
    initialPage,
    unit: "khách hàng",
    request: (query, page, signal) => {
      const params = new URLSearchParams({ page: String(page), size: "10" });
      if (query) params.set("keyword", query);
      return getCustomerPage(params.toString(), signal);
    },
    buildUrl: (query, page) => searchUrl("/quan-tri/khach-hang", {
      keyword: query,
      page: page > 0 ? page : null,
    }),
  });

  const canWrite = can("CUSTOMER_CREATE");
  const rows = live.data?.content ?? [];
  return <AdminShellB active="customers" title="Khách hàng">
    <PageHeader
      title="Khách hàng"
      hint={canWrite ? "Hồ sơ liên hệ khách hàng; hạng và điểm do hệ thống tính." : "Tài khoản hiện tại chỉ đọc."}
      actions={<><CsvExportButton dataset="customers" query={customerCsvQuery({ keyword: live.term })} confirm />{canWrite ? <button className="primary" type="button" onClick={() => setCreating(true)}>Tạo khách hàng</button> : null}</>}
    />
    <AdminModal open={creating} title="Tạo khách hàng" size="md" busy={busy} onClose={() => { if (!busy) setCreating(false); }}
      footer={<><button className="secondary" type="button" disabled={busy} onClick={() => setCreating(false)}>Hủy</button><button className="primary" type="submit" form="customer-create-form" disabled={busy}>{busy ? "Đang lưu…" : "Tạo khách hàng"}</button></>}>
      <CustomerForm mode="create" formId="customer-create-form" onBusyChange={setBusy}
        onSaved={(c) => { setCreating(false); toast.success(`Đã tạo khách hàng ${[c.firstName, c.lastName].filter(Boolean).join(" ")}.`); live.reload(); }} />
    </AdminModal>
    <form className="orders-filters l3-filters" role="search" onSubmit={(e) => { e.preventDefault(); live.searchNow(); }}>
      <LiveSearchField
        id="cust-search"
        label="Tìm theo tên / SĐT / email"
        placeholder="Tìm theo tên, SĐT hoặc email"
        input={live.inputProps}
        onClear={live.clear}
        showClear={live.typed.length > 0}
      />
      {live.typed ? <button className="secondary" type="button" onClick={live.clear}>Đặt lại</button> : null}
      <span className="meta live-search-status" role="status" aria-live="polite">{live.tooShort ? live.statusText : ""}</span>
    </form>
    {live.error ? <div className="order-empty" role="alert"><strong>Không tải được khách hàng</strong><p>{live.error}</p><button className="secondary" type="button" onClick={live.reload}>Thử lại</button></div> : null}
    {live.loading && !live.data ? <TableSkeleton rows={10} columns={6} /> : null}
    {!live.loading && !live.error && live.data?.content.length === 0 ? <div className="order-empty"><strong>Không có khách hàng khớp</strong><p>{live.term ? `Không tìm thấy khách hàng cho “${live.term}”. Thử từ khóa khác.` : "Chưa có khách hàng nào."}</p></div> : null}
    {rows.length > 0 ? <div className="table-scroll sticky-head review-table-scroll table-cards" tabIndex={0} aria-label="Danh sách khách hàng" aria-busy={live.loading}><table className="review-orders-table l3-table"><caption className="sr-only">Danh sách khách hàng</caption><thead><tr><th>Khách hàng</th><th>Số điện thoại</th><th>Giới tính</th><th>Địa chỉ</th><th>Hạng</th><th className="num">Điểm</th></tr></thead><tbody>{rows.map((c) => {
      const name = [c.firstName, c.lastName].filter(Boolean).join(" ") || c.lastName;
      return <RowLink key={c.id} href={`/quan-tri/khach-hang/${c.id}`}>
        <td data-label="Khách hàng" className="cell-title"><Link className="pl-name" href={`/quan-tri/khach-hang/${c.id}`}>{name}</Link></td>
        <td data-label="Số điện thoại" className="tabnum">{c.phoneNumber}</td>
        <td data-label="Giới tính">{c.gender ? genderLabel(c.gender) : EMPTY}</td>
        <td data-label="Địa chỉ">{c.address ? <span className="l3-clip" title={c.address}>{c.address}</span> : EMPTY}</td>
        <td data-label="Hạng"><TierBadge name={c.tierName} /></td>
        <td data-label="Điểm" className="num"><Num value={c.accumulatePoint ?? 0} tone="amber" /></td>
      </RowLink>;
    })}</tbody></table></div> : null}
    {live.data && live.data.content.length > 0 ? <Pager page={live.page} totalPages={live.data.totalPages} total={live.data.totalElements} unit="khách hàng" busy={live.loading} onPage={live.goToPage} /> : null}
  </AdminShellB>;
}
