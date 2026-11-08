"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AdminShellB } from "@/components/admin-b/admin-shell";
import { CsvExportButton } from "@/components/admin-b/csv-export-button";
import { LiveSearchField } from "@/components/admin-b/live-search-field";
import { PageHeader } from "@/components/admin-b/page-header";
import { Pager } from "@/components/admin-b/pagination";
import { RowLink } from "@/components/admin-b/row-link";
import { TableSkeleton } from "@/components/admin-b/skeleton";
import { Num, StockBadge } from "@/components/admin-b/status-badge";
import { useLiveSearch } from "@/components/admin-b/use-live-search";
import { getStockPage, type Page, type Stock } from "@/lib/admin-stock-client";
import { stockCsvQuery } from "@/lib/admin-csv";
import { searchUrl } from "@/lib/live-search";

type Summary = { totalSkus: number; outOfStock: number; lowStock: number; healthyStock: number };

export const availableTone = (available: number | null, threshold: number | null) =>
  available === null || available === undefined ? undefined : available <= 0 ? "red" as const : threshold !== null && threshold !== undefined && available <= threshold ? "amber" as const : "green" as const;

const none = <span className="empty-value">—</span>;

export function StockListClient({ initialKeyword, initialPage }: { initialKeyword: string; initialPage: number }) {
  const [summary, setSummary] = useState<Summary | null>(null);
  const live = useLiveSearch<Page<Stock>>({
    initialQuery: initialKeyword,
    initialPage,
    unit: "SKU",
    request: (query, page, signal) => {
      const params = new URLSearchParams({ page: String(page), size: "10" });
      if (query) params.set("keyword", query);
      return getStockPage(params.toString(), signal);
    },
    buildUrl: (query, page) => searchUrl("/quan-tri/ton-kho", {
      keyword: query,
      page: page > 0 ? page : null,
    }),
  });

  useEffect(() => {
    const c = new AbortController();
    fetch("/api/admin/stock-summary?limit=1", { cache: "no-store", signal: c.signal })
      .then((r) => r.json())
      .then((j) => { if (j?.success && j.result) setSummary(j.result as Summary); })
      .catch(() => {});
    return () => c.abort();
  }, []);

  const rows = live.data?.content ?? [];
  return <AdminShellB active="stock" title="Tồn kho">
    <PageHeader
      title="Tồn kho"
      hint="Tồn kho tính theo SKU, chưa có thông tin kho hoặc vị trí. Ngưỡng cảnh báo chỉ đọc."
      actions={<CsvExportButton dataset="stock" query={stockCsvQuery({ keyword: live.term })} />}
    />
    {summary ? <div className="stock-chips" aria-label="Tổng quan tồn kho">
      <span className="stock-chip"><span>Tổng SKU</span><Num tone="blue" value={summary.totalSkus} /></span>
      <span className="stock-chip"><span>Hết hàng</span><Num tone="red" dimZero={false} value={summary.outOfStock} /></span>
      <span className="stock-chip"><span>Sắp hết</span><Num tone="amber" dimZero={false} value={summary.lowStock} /></span>
      <span className="stock-chip"><span>Ổn định</span><Num tone="green" dimZero={false} value={summary.healthyStock} /></span>
    </div> : null}
    <form className="orders-filters l3-filters" role="search" onSubmit={(e) => { e.preventDefault(); live.searchNow(); }}>
      <LiveSearchField
        id="st-keyword"
        label="Tìm kiếm"
        placeholder="Tìm SKU, Barcode, tên, màu, cỡ"
        input={live.inputProps}
        onClear={live.clear}
        showClear={live.typed.length > 0}
      />
      {live.typed ? <button className="secondary" type="button" onClick={live.clear}>Đặt lại</button> : null}
      <span className="meta live-search-status" role="status" aria-live="polite">{live.tooShort ? live.statusText : ""}</span>
    </form>
    {live.error ? <div className="order-empty" role="alert"><strong>Không tải được tồn kho</strong><p>{live.error}</p><button className="secondary" type="button" onClick={live.reload}>Thử lại</button></div> : null}
    {live.loading && !live.data ? <TableSkeleton rows={10} columns={7} /> : null}
    {!live.loading && !live.error && rows.length === 0 && live.data ? <div className="order-empty"><strong>Không có SKU khớp</strong><p>{live.term ? `Không tìm thấy SKU cho “${live.term}”. Thử từ khóa khác.` : "Chưa có SKU nào."}</p></div> : null}
    {rows.length > 0 ? <div className="table-scroll sticky-head review-table-scroll table-cards" tabIndex={0} aria-label="Danh sách tồn kho theo SKU" aria-busy={live.loading}><table className="review-orders-table l3-table"><caption className="sr-only">Danh sách tồn kho theo SKU</caption><thead><tr><th>SKU</th><th>Sản phẩm</th><th className="num">Vật lý</th><th className="num">Tạm giữ</th><th className="num">Khả dụng</th><th className="num">Ngưỡng</th><th>Trạng thái</th></tr></thead><tbody>{rows.map((s) => {
      const tone = availableTone(s.availableStock, s.minThreshold);
      const variant = [s.color, s.size].filter(Boolean).join(" · ");
      return <RowLink key={s.skuId} href={`/quan-tri/ton-kho/${s.skuId}`}>
        <td data-label="SKU" className="tabnum"><Link className="text-link" href={`/quan-tri/ton-kho/${s.skuId}`}>{s.skuId}</Link></td>
        <td data-label="Sản phẩm" className="cell-title st-product"><span className="st-name">{s.productName}</span><small className="meta">{variant || "Chưa có màu/cỡ"}{s.barcode ? ` · ${s.barcode}` : ""}</small></td>
        <td data-label="Vật lý" className="num">{s.physicalStock === null ? none : <Num tone="ink" dimZero={false} value={s.physicalStock} />}</td>
        <td data-label="Tạm giữ" className="num">{s.reservedStock === null ? none : <Num tone="violet" value={s.reservedStock} />}</td>
        <td data-label="Khả dụng" className="num">{s.availableStock === null ? none : <Num tone={tone} dimZero={false} bold value={s.availableStock} />}</td>
        <td data-label="Ngưỡng" className="num">{s.minThreshold === null ? none : <Num tone="gray" dimZero={false} value={s.minThreshold} />}</td>
        <td data-label="Trạng thái"><StockBadge available={s.availableStock} threshold={s.minThreshold} /></td>
      </RowLink>;
    })}</tbody></table></div> : null}
    {live.data && rows.length > 0 ? <Pager page={live.page} totalPages={live.data.totalPages} total={live.data.totalElements} unit="SKU" busy={live.loading} onPage={live.goToPage} /> : null}
  </AdminShellB>;
}

