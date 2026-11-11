"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { AdminShellB } from "@/components/admin-b/admin-shell";
import { CsvExportButton } from "@/components/admin-b/csv-export-button";
import { LiveSearchField } from "@/components/admin-b/live-search-field";
import { PageHeader } from "@/components/admin-b/page-header";
import { RowLink } from "@/components/admin-b/row-link";
import { TableSkeleton } from "@/components/admin-b/skeleton";
import { Pager } from "@/components/admin-b/pagination";
import { ProductImage } from "@/components/admin-b/product-image";
import { StatusBadge } from "@/components/admin-b/status-badge";
import { useLiveSearch } from "@/components/admin-b/use-live-search";
import { useAdminCan } from "@/components/admin-b/use-admin-role";
import { getCategories, getProductPage, type Category, type ProductPage } from "@/lib/admin-catalog-client";
import { productCsvQuery } from "@/lib/admin-csv";
import { formatNumber } from "@/lib/admin-format";
import { searchUrl } from "@/lib/live-search";

const STATUS = ["", "DRAFT", "ACTIVE", "OUT_OF_STOCK", "DISCONTINUED"];
const STATUS_LABEL: Record<string, string> = { DRAFT: "Draft", ACTIVE: "Đang bán", OUT_OF_STOCK: "Tạm hết hàng", DISCONTINUED: "Ngừng kinh doanh" };
function displayStatus(p: { status: string; publicationStatus?: string | null }): string {
  if (p.status === "DISCONTINUED") return STATUS_LABEL.DISCONTINUED;
  if (p.publicationStatus === "UNPUBLISHED" && (p.status === "ACTIVE" || p.status === "OUT_OF_STOCK")) return "Đã Unpublish";
  if (p.publicationStatus === "DRAFT" && (p.status === "ACTIVE" || p.status === "OUT_OF_STOCK")) return "Chưa Publish";
  return STATUS_LABEL[p.status] ?? p.status;
}
function statusKey(p: { status: string; publicationStatus?: string | null }): string {
  if (p.status === "DISCONTINUED") return "DISCONTINUED";
  if (p.publicationStatus === "UNPUBLISHED" && (p.status === "ACTIVE" || p.status === "OUT_OF_STOCK")) return "UNPUBLISHED";
  if (p.publicationStatus === "DRAFT" && (p.status === "ACTIVE" || p.status === "OUT_OF_STOCK")) return "DRAFT";
  return p.status;
}

type Props = {
  initialKeyword: string;
  initialCategoryId: string;
  initialStatus: string;
  initialPage: number;
};

export function AdminProductsClient({ initialKeyword, initialCategoryId, initialStatus, initialPage }: Props) {
  const can = useAdminCan();
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryId, setCategoryId] = useState(initialCategoryId);
  const [status, setStatus] = useState(initialStatus);
  const live = useLiveSearch<ProductPage>({
    initialQuery: initialKeyword,
    initialPage,
    unit: "sản phẩm",
    filtersKey: `${categoryId}|${status}`,
    request: (query, page, signal) => {
      const params = new URLSearchParams({ page: String(page), size: "10" });
      if (query) params.set("keyword", query);
      if (categoryId) params.set("categoryId", categoryId);
      if (status) params.set("status", status);
      return getProductPage(params.toString(), signal);
    },
    buildUrl: (query, page) => searchUrl("/quan-tri/san-pham", {
      keyword: query,
      categoryId,
      status,
      page: page > 0 ? page : null,
    }),
  });

  useEffect(() => {
    const controller = new AbortController();
    getCategories(controller.signal).then(setCategories).catch(() => setCategories([]));
    return () => controller.abort();
  }, []);

  // The address bar also wins if a cached Back payload carries older filter props.
  useEffect(() => {
    void Promise.resolve().then(() => {
      const params = new URLSearchParams(window.location.search);
      const nextCategory = params.get("categoryId") ?? "";
      const nextStatus = params.get("status") ?? "";
      setCategoryId((current) => (current === nextCategory ? current : nextCategory));
      setStatus((current) => (current === nextStatus ? current : nextStatus));
    });
  }, []);

  // Same-route navigation passes fresh server props without remounting this component.
  const previousFilters = useRef({ categoryId: initialCategoryId, status: initialStatus });
  useEffect(() => {
    const previous = previousFilters.current;
    if (previous.categoryId === initialCategoryId && previous.status === initialStatus) return;
    previousFilters.current = { categoryId: initialCategoryId, status: initialStatus };
    void Promise.resolve().then(() => {
      setCategoryId(initialCategoryId);
      setStatus(initialStatus);
    });
  }, [initialCategoryId, initialStatus]);

  // Back/Forward restores the select filters; the hook restores the text and page.
  useEffect(() => {
    function onPopState() {
      const params = new URLSearchParams(window.location.search);
      setCategoryId(params.get("categoryId") ?? "");
      setStatus(params.get("status") ?? "");
    }
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  function reset() {
    setCategoryId("");
    setStatus("");
    live.clear();
  }

  const manage = can("PRODUCT_EDIT"); const canImport = can("PRODUCT_IMPORT");
  const filtered = categoryId !== "" || status !== "" || live.term !== "";
  return <AdminShellB active="products" title="Sản phẩm" eyebrow="Vận hành · sản phẩm">
    <PageHeader title="Sản phẩm" hint={manage ? undefined : "Tài khoản hiện tại chỉ đọc."} actions={<><CsvExportButton dataset="products" query={productCsvQuery({ keyword: live.term, categoryId, status })} />{canImport ? <Link className="secondary" href="/quan-tri/san-pham/nhap-csv">Import CSV</Link> : null}{manage ? <Link className="primary" href="/quan-tri/san-pham/new">Tạo sản phẩm</Link> : null}</>} />
    <form className="orders-filters pl-filters" onSubmit={(e) => { e.preventDefault(); live.searchNow(); }}>
      <LiveSearchField
        id="p-keyword"
        label="Từ khóa"
        placeholder="Tìm tên, thương hiệu, SKU hoặc Barcode"
        input={live.inputProps}
        onClear={live.clear}
        showClear={live.typed.length > 0}
      />
      <select id="p-category" className="catalog-input" aria-label="Danh mục" value={categoryId} onChange={(e) => { setCategoryId(e.target.value); live.searchNow(); }}><option value="">Mọi danh mục</option>{categories.map((c) => <option key={c.id} value={c.id}>{c.categoryName}</option>)}</select>
      <select id="p-status" className="catalog-input" aria-label="Trạng thái" value={status} onChange={(e) => { setStatus(e.target.value); live.searchNow(); }}>{STATUS.map((s) => <option key={s || "all"} value={s}>{s ? STATUS_LABEL[s] : "Mọi trạng thái"}</option>)}</select>
      {filtered ? <button className="secondary btn-sm" type="button" onClick={reset}>Đặt lại</button> : null}
    </form>
    <p className="sr-only" role="status" aria-live="polite">{live.statusText}</p>
    {live.loading && !live.data ? <TableSkeleton rows={10} columns={5} rowHeight={52} /> : null}
    {live.error ? <div className="order-empty" role="alert"><strong>Không tải được sản phẩm</strong><p>{live.error}</p><button className="secondary" type="button" onClick={live.reload}>Thử lại</button></div> : null}
    {!live.loading && !live.error && live.data?.content.length === 0 ? <div className="order-empty"><strong>Không có sản phẩm khớp</strong><p>{live.term ? `Không tìm thấy kết quả cho “${live.term}”. Thử từ khóa khác.` : "Thử bỏ lọc hoặc chọn trạng thái khác."}</p></div> : null}
    {live.data && live.data.content.length > 0 ? <div className="table-scroll sticky-head review-table-scroll table-cards" tabIndex={0} aria-label="Danh sách sản phẩm" aria-busy={live.loading}><table className="review-orders-table fit-table pl-table"><caption className="sr-only">Danh sách sản phẩm</caption><thead><tr><th>Ảnh</th><th>Tên sản phẩm</th><th>Danh mục</th><th className="num">Giá</th><th>Trạng thái</th></tr></thead><tbody>{live.data.content.map((p) => <RowLink key={p.id} href={`/quan-tri/san-pham/${p.id}`} className="has-thumb">
      <td data-label="Ảnh" className="product-image-cell"><span className="pl-thumb"><ProductImage src={p.imageUrl} alt={p.productName} /></span></td>
      <td data-label="" className="cell-title"><Link className="pl-name" href={`/quan-tri/san-pham/${p.id}`}>{p.productName}</Link>{p.material ? <small>{p.material}</small> : null}</td>
      <td data-label="Danh mục">{p.categoryName ?? <span className="empty-value">Chưa có</span>}</td>
      <td data-label="Giá" className="num"><span className="money">{formatNumber(p.price)}<span className="unit">VND</span></span></td>
      <td data-label="Trạng thái"><StatusBadge status={statusKey(p)} label={displayStatus(p)} /></td>
    </RowLink>)}</tbody></table></div> : null}
    {live.data && live.data.content.length > 0 ? <Pager page={live.page} totalPages={live.data.totalPages} total={live.data.totalElements} unit="sản phẩm" busy={live.loading} onPage={live.goToPage} /> : null}
  </AdminShellB>;
}
