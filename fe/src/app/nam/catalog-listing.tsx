"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { StorefrontShell } from "@/components/storefront/storefront-shell";
import { loadFavoriteIds, toggleFavoriteServer } from "@/lib/favorites-store";
import { ChevronDownIcon, HeartIcon } from "@/components/customer-catalog/catalog-icons";
import {
  CatalogError,
  fetchCatalogCategories,
  fetchCatalogProducts,
  formatVnd,
  type CatalogCategory,
  type CatalogPage,
  type CatalogProduct,
  fetchCatalogBrands,
  type CatalogBrand,
} from "@/lib/customer-catalog";
import "@/components/customer-catalog/catalog.css";

type Filters = {
  brand: string;
  categoryId: string;
  keyword: string;
  minPrice: string;
  maxPrice: string;
  sort: string;
};

const EMPTY_FILTERS: Filters = { brand: "", categoryId: "", keyword: "", minPrice: "", maxPrice: "", sort: "id,desc" };
const PAGE_SIZE = 6;

function CatalogImage({ src, alt }: { src: string | null; alt: string }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return (
      <span className="cat-image-fail" role="img" aria-label={`Không tải được ảnh: ${alt}`}>
        Không tải được ảnh sản phẩm
      </span>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element -- ảnh từ imageUrl BE/minh họa; không qua Image optimizer
    <img src={src} alt={alt} loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={() => setFailed(true)} />
  );
}

function FavoriteButton({ id, name }: { id: number; name: string }) {
  const [loved, setLoved] = useState<boolean | null>(null);
  useEffect(() => {
    let active = true;
    loadFavoriteIds().then((ids) => { if (active) setLoved(ids.has(id)); }).catch(() => { if (active) setLoved(false); });
    return () => { active = false; };
  }, [id]);
  const isLoved = loved ?? false;
  return (
    <button
      className="cat-favorite"
      type="button"
      aria-pressed={isLoved}
      aria-label={`${isLoved ? "Bỏ yêu thích" : "Yêu thích"} ${name}`}
      onClick={async () => {
        try {
          const next = await toggleFavoriteServer(id);
          setLoved(next);
        } catch {
          window.location.href = "/dang-nhap?next=" + encodeURIComponent(window.location.pathname);
        }
      }}
    >
      <HeartIcon filled={isLoved} />
    </button>
  );
}

function ProductCard({ product }: { product: CatalogProduct }) {
  return (
    <article className="cat-product-card">
      <div className="cat-product-photo-wrap">
        <Link className="cat-product-photo" href={`/san-pham/${product.id}`} aria-label={`Xem ${product.name}`}>
          <CatalogImage src={product.imageUrl} alt={product.name} />
        </Link>
        <FavoriteButton id={product.id} name={product.name} />
      </div>
      <div className="cat-product-info">
        {product.brandName ? <span className="cat-product-brand">{product.brandName}</span> : null}
        <h3>
          <Link className="cat-product-name" href={`/san-pham/${product.id}`}>
            {product.name}
          </Link>
        </h3>
        <span className="cat-product-price">{formatVnd(product.price)}</span>
        <p className="cat-product-meta">
          {[product.categoryName, product.material, product.style].filter(Boolean).join(" · ") || "Thông tin danh mục"}
        </p>
      </div>
    </article>
  );
}

function FilterFields({
  prefix,
  filters,
  brands,
  onBrand,
  draft,
  categories,
  categoriesLoading,
  categoriesError,
  onRetryCategories,
  onCategory,
  onDraft,
  onApply,
  onReset,
  error,
}: {
  prefix: string;
  filters: Filters;
  draft: { keyword: string; minPrice: string; maxPrice: string };
  categories: CatalogCategory[];
  categoriesLoading: boolean;
  categoriesError: string;
  onRetryCategories: () => void;
  onCategory: (value: string) => void;
  brands: CatalogBrand[];
  onBrand: (value: string) => void;
  onDraft: (next: { keyword: string; minPrice: string; maxPrice: string }) => void;
  onApply: () => void;
  onReset: () => void;
  error: string;
}) {
  return (
    <>
      <h2>Bộ lọc</h2>
      {brands.length > 0 ? (
        <fieldset className="cat-filter-group">
          <legend>Thương hiệu</legend>
          <label className="cat-filter-option">
            <input type="radio" name={`${prefix}-brand`} checked={filters.brand === ""} onChange={() => onBrand("")} />
            <span>Tất cả thương hiệu</span>
          </label>
          {brands.map((brand) => (
            <label className="cat-filter-option" key={brand.slug}>
              <input
                type="radio"
                name={`${prefix}-brand`}
                checked={filters.brand === brand.slug}
                onChange={() => onBrand(brand.slug)}
              />
              <span>{brand.name}</span>
            </label>
          ))}
        </fieldset>
      ) : null}

      <fieldset className="cat-filter-group">
        <legend>Danh mục</legend>
        <label className="cat-filter-option">
          <input type="radio" name={`${prefix}-cat`} checked={filters.categoryId === ""} onChange={() => onCategory("")} />
          <span>Tất cả</span>
        </label>
        {categories.map((category) => (
          <label className="cat-filter-option" key={category.id}>
            <input
              type="radio"
              name={`${prefix}-cat`}
              checked={filters.categoryId === String(category.id)}
              onChange={() => onCategory(String(category.id))}
            />
            <span>{category.name}</span>
          </label>
        ))}
        {categoriesLoading ? <p className="cat-filter-note" role="status">Đang tải danh mục…</p> : null}
        {!categoriesLoading && categoriesError ? (
          <p className="cat-filter-note" role="alert">
            {categoriesError}{" "}
            <button className="cat-text-button" type="button" onClick={onRetryCategories}>Thử lại danh mục</button>
          </p>
        ) : null}
      </fieldset>
      <fieldset className="cat-filter-group">
        <legend>Khoảng giá</legend>
        <div className="cat-price-grid">
          <div className="cat-field">
            <label htmlFor={`${prefix}-min`}>Từ</label>
            <input id={`${prefix}-min`} className="cat-input" inputMode="numeric" value={draft.minPrice} onChange={(e) => onDraft({ ...draft, minPrice: e.target.value.replace(/[^\d]/g, "") })} />
          </div>
          <div className="cat-field">
            <label htmlFor={`${prefix}-max`}>Đến</label>
            <input id={`${prefix}-max`} className="cat-input" inputMode="numeric" value={draft.maxPrice} onChange={(e) => onDraft({ ...draft, maxPrice: e.target.value.replace(/[^\d]/g, "") })} />
          </div>
        </div>
      </fieldset>
      <div className="cat-field" style={{ marginBottom: 18 }}>
        <label htmlFor={`${prefix}-keyword`}>Tìm theo tên</label>
        <input id={`${prefix}-keyword`} className="cat-input" value={draft.keyword} maxLength={200} onChange={(e) => onDraft({ ...draft, keyword: e.target.value })} />
      </div>
      {error ? <p className="cat-filter-note" role="alert">{error}</p> : null}
      <button className="cat-button cat-filter-apply" type="button" onClick={onApply}>
        Áp dụng
      </button>
      <button className="cat-text-button cat-filter-reset" type="button" onClick={onReset}>
        Xóa bộ lọc
      </button>
    </>
  );
}

export function CatalogListing() {
  const [categoryAttempt, setCategoryAttempt] = useState(0);
  const [categorySettled, setCategorySettled] = useState<{ attempt: number; list?: CatalogCategory[]; error?: string }>({ attempt: -1 });
  const categories = categorySettled.attempt === categoryAttempt ? categorySettled.list ?? [] : [];
  const categoriesLoading = categorySettled.attempt !== categoryAttempt;
  const categoryError = categorySettled.attempt === categoryAttempt ? categorySettled.error ?? "" : "";
  const [brands, setBrands] = useState<CatalogBrand[]>([]);
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [draft, setDraft] = useState({ keyword: "", minPrice: "", maxPrice: "" });
  const [filterError, setFilterError] = useState("");
  const [page, setPage] = useState(0);
  const [retry, setRetry] = useState(0);
  const reqId = useRef(0);
  const queryKey = JSON.stringify({ filters, page, retry });
  const [settled, setSettled] = useState<{ key: string; data?: CatalogPage; error?: string }>({ key: "" });
  const loading = settled.key !== queryKey;
  const data = settled.key === queryKey ? settled.data ?? null : null;
  const error = settled.key === queryKey ? settled.error ?? "" : "";

  useEffect(() => {
    const controller = new AbortController();
    // Thương hiệu là metadata thật; danh sách rỗng thì ẩn bộ lọc thay vì bịa.
    fetchCatalogBrands(controller.signal)
      .then((list) => { if (!controller.signal.aborted) setBrands(list); })
      .catch(() => { if (!controller.signal.aborted) setBrands([]); });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    fetchCatalogCategories(controller.signal)
      .then((list) => {
        if (controller.signal.aborted) return;
        setCategorySettled({ attempt: categoryAttempt, list });
      })
      .catch((err) => {
        if (controller.signal.aborted) return;
        setCategorySettled({
          attempt: categoryAttempt,
          error: err instanceof CatalogError ? err.message : "Không kết nối được máy chủ danh mục. Thử lại.",
        });
      });
    return () => controller.abort();
  }, [categoryAttempt]);

  useEffect(() => {
    const controller = new AbortController();
    const my = ++reqId.current;
    fetchCatalogProducts(
      {
        brand: filters.brand || undefined,
        categoryId: filters.categoryId ? Number(filters.categoryId) : null,
        keyword: filters.keyword,
        minPrice: filters.minPrice ? Number(filters.minPrice) : null,
        maxPrice: filters.maxPrice ? Number(filters.maxPrice) : null,
        page,
        size: PAGE_SIZE,
        sort: filters.sort,
      },
      controller.signal,
    )
      .then((result) => {
        if (reqId.current !== my) return;
        setSettled({ key: queryKey, data: result });
      })
      .catch((err) => {
        if (controller.signal.aborted || reqId.current !== my) return;
        setSettled({
          key: queryKey,
          error: err instanceof CatalogError ? err.message : "Không kết nối được máy chủ danh mục. Thử lại.",
        });
      });
    return () => controller.abort();
  }, [filters, page, retry, queryKey]);

  function commit(next: Filters, nextPage = 0) {
    setFilters(next);
    setPage(nextPage);
  }

  function applyDraft() {
    const min = draft.minPrice ? Number(draft.minPrice) : null;
    const max = draft.maxPrice ? Number(draft.maxPrice) : null;
    if (min !== null && max !== null && min > max) {
      setFilterError("Giá từ phải nhỏ hơn hoặc bằng giá đến.");
      return;
    }
    setFilterError("");
    commit({ ...filters, keyword: draft.keyword.trim(), minPrice: draft.minPrice, maxPrice: draft.maxPrice });
  }

  function reset() {
    setDraft({ keyword: "", minPrice: "", maxPrice: "" });
    setFilterError("");
    commit(EMPTY_FILTERS);
  }

  const appliedChips = [
    filters.brand ? { key: "brand", label: brands.find((b) => b.slug === filters.brand)?.name ?? filters.brand } : null,
    filters.categoryId ? { key: "category", label: categories.find((c) => String(c.id) === filters.categoryId)?.name ?? "Danh mục" } : null,
    filters.keyword ? { key: "keyword", label: `“${filters.keyword}”` } : null,
    filters.minPrice ? { key: "min", label: `Từ ${formatVnd(Number(filters.minPrice))}` } : null,
    filters.maxPrice ? { key: "max", label: `Đến ${formatVnd(Number(filters.maxPrice))}` } : null,
  ].filter(Boolean) as Array<{ key: string; label: string }>;

  const filterProps = {
    filters,
    brands,
    onBrand: (brand: string) => commit({ ...filters, brand }),
    draft,
    categories,
    categoriesLoading,
    categoriesError: categoryError,
    onRetryCategories: () => setCategoryAttempt((n) => n + 1),
    onCategory: (categoryId: string) => commit({ ...filters, categoryId }),
    onDraft: setDraft,
    onApply: applyDraft,
    onReset: reset,
    error: filterError,
  };

  return (
    <StorefrontShell active="/nam" themed palette="customer" header="customer" footer="none">
      <div className="catPage">
        <div className="cat-content cat-catalog-content">
          <div className="cat-head cat-head-compact">
            <h1>Sản phẩm</h1>
          </div>
          <div className="cat-listing-layout">
            <aside className="cat-filter-panel cat-filter-desktop" aria-label="Bộ lọc">
              <FilterFields prefix="desktop" {...filterProps} />
            </aside>
            <section className="cat-listing-products" aria-label="Danh sách sản phẩm" aria-busy={loading}>
              <details className="cat-filter-mobile">
                <summary>Bộ lọc{appliedChips.length ? ` (${appliedChips.length})` : ""}</summary>
                <div className="cat-mobile-filter-body">
                  <FilterFields prefix="mobile" {...filterProps} />
                </div>
              </details>
              <div className="cat-listing-tools">
                <span className="cat-result-count" role="status">
                  {loading ? "Đang tải sản phẩm…" : `${data?.totalElements ?? 0} sản phẩm`}
                </span>
                <label className="cat-sort-control" htmlFor="listing-sort">
                  Sắp xếp
                  <span className="cat-sort-select-wrap">
                    <select
                      id="listing-sort"
                      className="cat-select"
                      value={filters.sort}
                      onChange={(e) => commit({ ...filters, sort: e.target.value })}
                    >
                      <option value="id,desc">Mặc định</option>
                      <option value="price,asc">Giá thấp đến cao</option>
                      <option value="price,desc">Giá cao đến thấp</option>
                      <option value="productName,asc">Tên A–Z</option>
                      <option value="productName,desc">Tên Z–A</option>
                    </select>
                    <span className="cat-sort-chevron" aria-hidden="true">
                      <ChevronDownIcon />
                    </span>
                  </span>
                </label>
              </div>
              {appliedChips.length ? (
                <div className="cat-applied-row">
                  {appliedChips.map((chip) => (
                    <button
                      className="cat-chip"
                      type="button"
                      key={chip.key}
                      onClick={() => {
                        if (chip.key === "brand") commit({ ...filters, brand: "" });
                        else if (chip.key === "category") commit({ ...filters, categoryId: "" });
                        else if (chip.key === "keyword") { setDraft({ ...draft, keyword: "" }); commit({ ...filters, keyword: "" }); }
                        else if (chip.key === "min") { setDraft({ ...draft, minPrice: "" }); commit({ ...filters, minPrice: "" }); }
                        else { setDraft({ ...draft, maxPrice: "" }); commit({ ...filters, maxPrice: "" }); }
                      }}
                    >
                      {chip.label} ×
                    </button>
                  ))}
                </div>
              ) : null}
              {error ? (
                <div className="cat-status cat-error" role="alert">
                  {error}{" "}
                  <button className="cat-text-button" type="button" onClick={() => setRetry((n) => n + 1)}>Thử lại</button>
                </div>
              ) : loading && !data ? (
                <div className="cat-skeleton-grid" aria-hidden="true">
                  {Array.from({ length: PAGE_SIZE }, (_, i) => <div className="cat-skeleton" key={i} />)}
                </div>
              ) : data && data.items.length === 0 ? (
                <div className="cat-empty">
                  <h2>Không có sản phẩm</h2>
                  <p>Thử bỏ bớt bộ lọc hoặc chọn danh mục khác.</p>
                  <button className="cat-text-button" type="button" onClick={reset}>Xóa bộ lọc</button>
                </div>
              ) : data ? (
                <>
                  <div className="cat-product-grid">
                    {data.items.map((product) => <ProductCard product={product} key={product.id} />)}
                  </div>
                  <details className="cat-source">
                    <summary>Nguồn ảnh</summary>
                    <div>Ảnh sản phẩm lấy từ trường imageUrl của API công khai; pilot chưa có metadata tác giả.</div>
                  </details>
                  {data.totalPages > 1 ? (
                    <nav className="cat-pagination" aria-label="Phân trang sản phẩm">
                      <button className="cat-button" type="button" disabled={page <= 0 || loading} onClick={() => setPage((p) => Math.max(0, p - 1))}>
                        Trang trước
                      </button>
                      <span>Trang {page + 1}/{data.totalPages}</span>
                      <button className="cat-button" type="button" disabled={page + 1 >= data.totalPages || loading} onClick={() => setPage((p) => p + 1)}>
                        Trang sau
                      </button>
                    </nav>
                  ) : null}
                </>
              ) : null}
              {loading && data ? <p className="cat-status cat-info" role="status">Đang cập nhật sản phẩm…</p> : null}
            </section>
          </div>
        </div>
      </div>
    </StorefrontShell>
  );
}
