"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { StorefrontShell } from "@/components/storefront/storefront-shell";
import { loadFavoriteIds, toggleFavoriteServer } from "@/lib/favorites-store";
import { BackIcon, ChevronDownIcon, ForwardIcon, HeartIcon } from "@/components/customer-catalog/catalog-icons";
import { pageWindow, parseJumpInput, visibleRange } from "@/lib/pagination";
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
const BRAND_VISIBLE_COUNT = 8;
// R5/DESIGN: tập danh mục có thể vượt 11 sau sửa taxonomy — 20 radio sẽ đẩy
// giá/tên/hãng xuống dưới. Cùng mẫu disclosure gọn như hãng: luồng trang
// thường, nút mở rộng rõ ràng, không khay cuộn lồng.

/** Nhãn hãng theo slug canonical: giữ bản sắc MLB Korea, tách bạch
    tham chiếu rỗng "MLB League" — không bao giờ hai nhãn "MLB" trần. */
export function brandLabel(slug: string, name: string): string {
  if (slug === "mlb-korea" && !/korea/i.test(name)) return "MLB Korea";
  if (slug === "mlb" && name.trim().toLowerCase() === "mlb") return "MLB League";
  return name;
}

/** Đọc bộ lọc từ URL — giữ tương thích query cũ (categoryId/brand/keyword/giá/sort/page). */
function filtersFromParams(p: { get: (k: string) => string | null }): Filters {
  const num = (k: string) => {
    const raw = p.get(k);
    return raw !== null && raw !== "" && Number.isFinite(Number(raw)) ? raw : "";
  };
  const sort = p.get("sort");
  return {
    brand: /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(p.get("brand") ?? "") ? (p.get("brand") as string) : "",
    categoryId: /^\d+$/.test(p.get("categoryId") ?? "") ? (p.get("categoryId") as string) : "",
    keyword: (p.get("keyword") ?? "").slice(0, 200),
    minPrice: num("minPrice"),
    maxPrice: num("maxPrice"),
    sort: sort === "price,asc" || sort === "price,desc" || sort === "productName,asc" || sort === "productName,desc" ? sort : "id,desc",
  };
}

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
  onNarrow,
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
  onNarrow?: () => void;
  error: string;
}) {
  const [brandQuery, setBrandQuery] = useState("");
  // R5: chỉ hiển thị tập con hữu ích + nút mở rộng rõ ràng — không khay cuộn lồng.
  const [showAllBrands, setShowAllBrands] = useState(false);
  const [showAllCats, setShowCats] = useState(false);
  return (
    <>
      <h2>Bộ lọc</h2>
      {/* R4-E: danh mục + giá đứng trước; thương hiệu gọn trong disclosure có ô tìm,
          để danh sách 27 hãng không đẩy danh mục/giá xuống dưới màn hình. */}

      <fieldset className="cat-filter-group">
        <legend>Danh mục</legend>
        <label className="cat-filter-option">
          <input type="radio" name={`${prefix}-cat`} checked={filters.categoryId === ""} onChange={() => onCategory("")} />
          <span>Tất cả</span>
        </label>
        {(showAllCats ? categories : categories.slice(0, BRAND_VISIBLE_COUNT)).map((category) => (
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
        {!showAllCats && categories.length > BRAND_VISIBLE_COUNT ? (
          <button
            className="cat-text-button cat-brand-more"
            type="button"
            aria-expanded={showAllCats}
            onClick={() => setShowCats(true)}
          >
            Xem thêm {categories.length - BRAND_VISIBLE_COUNT} danh mục
          </button>
        ) : null}
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
      {brands.length > 0 ? (
        <details className="cat-filter-group cat-brand-group" open={filters.brand !== ""}>
          <summary>
            Thương hiệu
            {filters.brand ? ` · ${brandLabel(filters.brand, brands.find((b) => b.slug === filters.brand)?.name ?? filters.brand)}` : ` · ${brands.length}`}
          </summary>
          <div className="cat-brand-body">
            <label className="cat-brand-search">
              <span className="cat-visually-hidden">Tìm thương hiệu</span>
              <input
                className="cat-input"
                type="search"
                placeholder="Tìm thương hiệu…"
                value={brandQuery}
                onChange={(event) => setBrandQuery(event.target.value)}
              />
            </label>
            <div className="cat-brand-list" role="radiogroup" aria-label="Thương hiệu">
              <label className="cat-filter-option">
                <input type="radio" name={`${prefix}-brand`} checked={filters.brand === ""} onChange={() => onBrand("")} />
                <span>Tất cả thương hiệu</span>
              </label>
              {(() => {
                const q = brandQuery.trim().toLowerCase();
                const matches = brands.filter((brand) => !q || brandLabel(brand.slug, brand.name).toLowerCase().includes(q));
                const visible = q || showAllBrands ? matches : matches.slice(0, BRAND_VISIBLE_COUNT);
                return (
                  <>
                    {visible.map((brand) => (
                      <label className="cat-filter-option" key={brand.slug}>
                        <input
                          type="radio"
                          name={`${prefix}-brand`}
                          checked={filters.brand === brand.slug}
                          onChange={() => onBrand(brand.slug)}
                        />
                        <span>{brandLabel(brand.slug, brand.name)}</span>
                      </label>
                    ))}
                    {!q && matches.length > BRAND_VISIBLE_COUNT ? (
                      <button
                        className="cat-text-button cat-brand-more"
                        type="button"
                        aria-expanded={showAllBrands}
                        onClick={() => setShowAllBrands((v) => !v)}
                      >
                        {showAllBrands ? "Thu gọn" : `Xem thêm ${matches.length - BRAND_VISIBLE_COUNT} hãng`}
                      </button>
                    ) : null}
                    {q && matches.length === 0 ? (
                      <p className="cat-filter-note" role="status">Không có hãng nào khớp “{brandQuery.trim()}”.</p>
                    ) : null}
                  </>
                );
              })()}
            </div>
          </div>
        </details>
      ) : null}
      {error ? <p className="cat-filter-note" role="alert">{error}</p> : null}
      <button className="cat-button cat-filter-apply" type="button" onClick={() => { onApply(); onNarrow?.(); }}>
        Áp dụng
      </button>
      <button className="cat-text-button cat-filter-reset" type="button" onClick={() => { onReset(); onNarrow?.(); }}>
        Xóa bộ lọc
      </button>
    </>
  );
}

function jumpErrorText(code: string, totalPages: number): string {
  if (code === "empty") return "Vui lòng nhập số trang.";
  if (code === "nan") return "Chỉ nhập số nguyên dương, ví dụ 27.";
  return `Nhập số trang từ 1 đến ${totalPages}.`;
}

/**
 * R5-pagination: compact numbered window + direct jump. 1-based UI,
 * 0-based API (goto converts explicitly). Server counts only, no hardcode.
 */
function Pagination({
  page,
  totalPages,
  loading,
  onGoto,
}: {
  page: number;
  totalPages: number;
  loading: boolean;
  onGoto: (page0: number) => void;
}) {
  const [jump, setJump] = useState("");
  const [jumpError, setJumpError] = useState<string | null>(null);
  const jumpInputId = "listing-jump";
  const jumpErrorId = "listing-jump-error";
  // Giới hạn trang đổi theo bộ lọc ⇒ lỗi cũ hết hiệu lực, xóa để nhập lại.
  useEffect(() => {
    setJumpError(null);
  }, [totalPages]);

  function goto(page0: number) {
    // Trang hiện tại: không fetch trùng, không đẩy history thừa.
    if (page0 === page) return;
    onGoto(page0);
  }

  function submitJump(event: React.FormEvent) {
    event.preventDefault();
    const parsed = parseJumpInput(jump, totalPages);
    if (parsed.error) {
      setJumpError(jumpErrorText(parsed.error, totalPages));
      return;
    }
    setJumpError(null);
    goto((parsed.page as number) - 1);
  }

  return (
    <nav className="cat-pagination" aria-label="Phân trang sản phẩm">
      <div className="cat-page-window">
        <button
          className="cat-page-btn"
          type="button"
          aria-label="Trang trước"
          disabled={page <= 0 || loading}
          onClick={() => goto(Math.max(0, page - 1))}
        >
          <BackIcon />
        </button>
        {pageWindow(page + 1, totalPages).map((token) =>
          token.kind === "gap" ? (
            <span className="cat-page-gap" key={token.key} aria-hidden="true">…</span>
          ) : token.page === page + 1 ? (
            <button
              className="cat-page-btn cat-page-current"
              type="button"
              key={token.page}
              aria-label={`Trang ${token.page}`}
              aria-current="page"
              disabled
            >
              {token.page}
            </button>
          ) : (
            <button
              className="cat-page-btn"
              type="button"
              key={token.page}
              aria-label={`Trang ${token.page}`}
              disabled={loading}
              onClick={() => goto(token.page - 1)}
            >
              {token.page}
            </button>
          ),
        )}
        <button
          className="cat-page-btn"
          type="button"
          aria-label="Trang sau"
          disabled={page + 1 >= totalPages || loading}
          onClick={() => goto(page + 1)}
        >
          <ForwardIcon />
        </button>
      </div>
      <form className="cat-page-jump" onSubmit={submitJump}>
        <label htmlFor={jumpInputId}>Đến trang</label>
        <input
          id={jumpInputId}
          className="cat-input cat-jump-input"
          inputMode="numeric"
          autoComplete="off"
          placeholder={`1–${totalPages}`}
          value={jump}
          maxLength={10}
          aria-invalid={jumpError ? true : undefined}
          aria-describedby={jumpError ? jumpErrorId : undefined}
          onChange={(e) => setJump(e.target.value)}
        />
        <button className="cat-button cat-jump-go" type="submit" disabled={loading}>
          Đi
        </button>
        {jumpError ? (
          <p className="cat-jump-error" role="alert" id={jumpErrorId}>
            {jumpError}
          </p>
        ) : null}
      </form>
    </nav>
  );
}

export type ListingVariant = {
  /** Đường dẫn nav được đánh dấu active. */
  shell: string;
  title: string;
  /** Ghi chú trung thực về dữ liệu thật đang nằm sau trang này. */
  note?: string;
  /** Liên kết nhanh chỉ dùng chiều dữ liệu thật (danh mục). */
  links?: Array<{ label: string; href: string }>;
  /** Hiện nhanh các thương hiệu thật làm liên kết (trang bộ sưu tập). */
  brandLinks?: boolean;
};

const DEFAULT_VARIANT: ListingVariant = { shell: "/nam", title: "Sản phẩm" };

export function CatalogListing({ variant = DEFAULT_VARIANT }: { variant?: ListingVariant } = {}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [categoryAttempt, setCategoryAttempt] = useState(0);
  const [categorySettled, setCategorySettled] = useState<{ attempt: number; list?: CatalogCategory[]; error?: string }>({ attempt: -1 });
  const categories = categorySettled.attempt === categoryAttempt ? categorySettled.list ?? [] : [];
  const categoriesLoading = categorySettled.attempt !== categoryAttempt;
  const categoryError = categorySettled.attempt === categoryAttempt ? categorySettled.error ?? "" : "";
  const [brands, setBrands] = useState<CatalogBrand[]>([]);
  // R5: bộ lọc là một phần của URL — Back/Forward và chia sẻ link giữ nguyên
  // kết quả server. Khởi tạo lười từ query hiện tại, đồng bộ khi params đổi.
  const [filters, setFilters] = useState<Filters>(() => filtersFromParams(params));
  const [draft, setDraft] = useState(() => ({
    keyword: params.get("keyword") ?? "",
    minPrice: params.get("minPrice") ?? "",
    maxPrice: params.get("maxPrice") ?? "",
  }));
  const [filterError, setFilterError] = useState("");
  const [page, setPage] = useState(() => Number(params.get("page") ?? "0") || 0);
  const [retry, setRetry] = useState(0);
  const mobileFilterRef = useRef<HTMLDetailsElement>(null);
  const reqId = useRef(0);
  const queryKey = JSON.stringify({ filters, page, retry });
  const [settled, setSettled] = useState<{ key: string; data?: CatalogPage; error?: string }>({ key: "" });
  const loading = settled.key !== queryKey;
  const data = settled.key === queryKey ? settled.data ?? null : null;
  const error = settled.key === queryKey ? settled.error ?? "" : "";
  // Điều hướng trang bằng control (khác đổi bộ lọc): khi dữ liệu mới về xong
  // mới cuộn + focus trạng thái — thông báo trang cho AT, không giật khi gõ jump.
  const pagedByNav = useRef(false);
  const statusRef = useRef<HTMLSpanElement>(null);

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

  function queryString(next: Filters, nextPage: number): string {
    const q = new URLSearchParams();
    if (next.brand) q.set("brand", next.brand);
    if (next.categoryId) q.set("categoryId", next.categoryId);
    if (next.keyword) q.set("keyword", next.keyword);
    if (next.minPrice) q.set("minPrice", next.minPrice);
    if (next.maxPrice) q.set("maxPrice", next.maxPrice);
    if (next.sort !== EMPTY_FILTERS.sort) q.set("sort", next.sort);
    if (nextPage > 0) q.set("page", String(nextPage));
    const qs = q.toString();
    return qs ? `${pathname}?${qs}` : pathname;
  }

  function replaceUrl(next: Filters, nextPage: number) {
    // P2: chi SUA LOI TU DONG moi replace — thay the entry URL hong/het han,
    // khong day them entry de Back khong bao gio ket vong lap.
    router.replace(queryString(next, nextPage), { scroll: false });
  }

  function pushUrl(next: Filters, nextPage: number) {
    // R5: push (explicit user actions) de Back/Forward buoc qua tung trang thai.
    router.push(queryString(next, nextPage), { scroll: false });
  }

  function commit(next: Filters, nextPage = 0) {
    setFilters(next);
    setPage(nextPage);
    pushUrl(next, nextPage);
  }

  // P2: sua loi TU DONG (late/out-of-range) dung replace — thay the entry hong,
  // khong day them entry. Moi dieu huong ro rang cua user giu nguyen push.
  function commitReplace(next: Filters, nextPage = 0) {
    setFilters(next);
    setPage(nextPage);
    replaceUrl(next, nextPage);
  }

  function gotoPage(nextPage: number) {
    pagedByNav.current = true;
    commit(filters, nextPage);
  }

  // Trang thật đổi xong (không phải đang tải) sau một lần bấm phân trang:
  // đưa đầu kết quả vào tầm nhìn dưới sticky header, focus trạng thái để AT
  // đọc trang mới. Đổi bộ lọc/sort (page reset) không cướp focus.
  const range = data && !loading ? visibleRange(page, PAGE_SIZE, data.totalElements) : null;
  useEffect(() => {
    if (pagedByNav.current && !loading && data && data.items.length > 0) {
      pagedByNav.current = false;
      const el = statusRef.current;
      if (el) {
        el.scrollIntoView({ block: "start", behavior: "auto" });
        el.focus({ preventScroll: true });
      }
    }
  }, [page, loading, data]);

  // Late page + bộ lọc thu hẹp (kể cả Back tới URL cũ): server trả rỗng mà
  // vẫn còn trang hợp lệ ⇒ về trang đầu một cách dự đoán được, không kẹt.
  useEffect(() => {
    if (!loading && data && data.items.length === 0 && page > 0 && data.totalPages > 0) {
      commitReplace(filters, 0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, data]);

  // Nút Back/Forward của trình duyệt: params đổi ⇒ state theo sau (một nguồn thật).
  useEffect(() => {
    const from = filtersFromParams(params);
    const fromPage = Number(params.get("page") ?? "0") || 0;
    const want = JSON.stringify({ ...from, page: fromPage });
    const cur = JSON.stringify({ ...filters, page });
    if (want !== cur) {
      setFilters(from);
      setDraft({ keyword: from.keyword, minPrice: from.minPrice, maxPrice: from.maxPrice });
      setPage(fromPage);
    }
    // Chỉ đồng bộ theo params ngoài (Back/link); state nội bộ không trigger lại.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

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
    filters.brand ? { key: "brand", label: brandLabel(filters.brand, brands.find((b) => b.slug === filters.brand)?.name ?? filters.brand) } : null,
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
    <StorefrontShell active={variant.shell} themed palette="customer" header="customer" footer="none">
      <div className="catPage">
        <div className="cat-content cat-catalog-content">
          <div className="cat-head cat-head-compact">
            <h1>{variant.title}</h1>
            {variant.note ? <p className="cat-product-meta" style={{ marginTop: 6 }}>{variant.note}</p> : null}
            {variant.links?.length || variant.brandLinks ? (
              <p className="cat-product-meta" style={{ marginTop: 6, display: "flex", gap: 12, flexWrap: "wrap" }}>
                {variant.links?.map((l) => <Link key={l.href} href={l.href} className="cat-text-button">{l.label}</Link>)}
                {variant.brandLinks ? brands.slice(0, 10).map((br) => <Link key={br.slug} href={`${pathname}?brand=${br.slug}`} className="cat-text-button">{brandLabel(br.slug, br.name)}</Link>) : null}
              </p>
            ) : null}
          </div>
          <div className="cat-listing-layout">
            <aside className="cat-filter-panel cat-filter-desktop" aria-label="Bộ lọc">
              <FilterFields prefix="desktop" {...filterProps} />
            </aside>
            <section className="cat-listing-products" aria-label="Danh sách sản phẩm" aria-busy={loading}>
              <details
                className="cat-filter-mobile"
                ref={mobileFilterRef}
                onKeyDown={(e) => { if (e.key === "Escape") e.currentTarget.removeAttribute("open"); }}
              >
                <summary>Bộ lọc{appliedChips.length ? ` (${appliedChips.length})` : ""}</summary>
                <div className="cat-mobile-filter-body">
                  <FilterFields
                    prefix="mobile"
                    {...filterProps}
                    onNarrow={() => mobileFilterRef.current?.removeAttribute("open")}
                  />
                </div>
              </details>
              <div className="cat-listing-tools">
                <span className="cat-result-count" role="status" tabIndex={-1} ref={statusRef}>
                  {loading ? "Đang tải sản phẩm…" : range ? `${range.from}–${range.to} trên ${data?.totalElements ?? 0} sản phẩm` : `${data?.totalElements ?? 0} sản phẩm`}
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
                    <Pagination page={page} totalPages={data.totalPages} loading={loading} onGoto={gotoPage} />
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
