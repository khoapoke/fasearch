"use client";

import { useEffect, useRef, useState } from "react";
import { pageWindow } from "@/lib/pagination";
import { BackIcon, ChevronDownIcon, ForwardIcon } from "@/components/customer-catalog/catalog-icons";
import { brandLabel, type PriceExtent, type StudyApi } from "./use-study-catalog";
import { PriceRange, StudyCard, StudyJump, type PriceBounds } from "./study-bits";
import { FilterSheet, SheetFooter } from "./direction-a";

const SORTS = [
  { v: "id,desc", label: "Mới nhất" },
  { v: "price,asc", label: "Giá ↑" },
  { v: "price,desc", label: "Giá ↓" },
  { v: "productName,asc", label: "Tên A–Z" },
  { v: "productName,desc", label: "Tên Z–A" },
];

/**
 * Hướng B — "Dải ngang" (R2).
 * Thanh lọc gọn một nhịp: tìm kiếm + danh mục + hãng + sắp xếp + nút Ngân
 * sách (tóm tắt range thật, panel neo desktop / sheet mobile), chips gỡ
 * từng điều kiện + reset. Phân trang range-led, bỏ nút Đầu/Cuối trùng số.
 */
export function DirectionB({ api }: { api: StudyApi }) {
  const { filters, draft, setDraft, page, brands, categories, extent, loading, data, error, range } = api;
  const [sheetOpen, setSheetOpen] = useState(false);
  const priceValue: PriceBounds = { lo: filters.minPrice ? Number(filters.minPrice) : null, hi: filters.maxPrice ? Number(filters.maxPrice) : null };

  useEffect(() => {
    document.title = "Nghiên cứu B — Dải ngang | FaSearch";
  }, []);

  function commitPrice(next: PriceBounds) {
    api.commit(
      { ...filters, minPrice: next.lo === null ? "" : String(next.lo), maxPrice: next.hi === null ? "" : String(next.hi) },
      0,
    );
  }

  const totalPages = data?.totalPages ?? 0;
  const window = pageWindow(page + 1, Math.max(totalPages, 1));
  const budgetLabel =
    priceValue.lo === null && priceValue.hi === null
      ? "Ngân sách"
      : `Ngân sách · ${priceValue.lo === null ? "…" : priceValue.lo.toLocaleString("vi-VN")}–${priceValue.hi === null ? "…" : priceValue.hi.toLocaleString("vi-VN")}`;

  const chips = [
    filters.categoryId ? { key: "category", label: categories.find((c) => String(c.id) === filters.categoryId)?.name ?? "Danh mục", clear: { ...filters, categoryId: "" } } : null,
    filters.brand ? { key: "brand", label: brandLabel(filters.brand, brands.find((b) => b.slug === filters.brand)?.name ?? filters.brand), clear: { ...filters, brand: "" } } : null,
    filters.keyword ? { key: "keyword", label: `“${filters.keyword}”`, clear: { ...filters, keyword: "" } } : null,
    filters.minPrice || filters.maxPrice ? { key: "price", label: `${filters.minPrice || "…"}–${filters.maxPrice || "…"}`, clear: { ...filters, minPrice: "", maxPrice: "" } } : null,
  ].filter(Boolean) as { key: string; label: string; clear: typeof filters }[];

  return (
    <div className="stB">
      <div className="stB-head">
        <h1>Sản phẩm</h1>
      </div>
      <div className="stB-bar" role="search" aria-label="Bộ lọc nhanh">
        <label className="stB-field stB-grow">
          <span className="st-visually-hidden">Tìm theo tên</span>
          <input
            className="st-input"
            value={draft.keyword}
            maxLength={200}
            placeholder="Tìm: áo thun…"
            onChange={(e) => setDraft({ keyword: e.target.value })}
            onKeyDown={(e) => { if (e.key === "Enter") api.commit({ ...filters, keyword: draft.keyword.trim() }, 0); }}
          />
        </label>
        <label className="stB-field">
          <span className="st-visually-hidden">Danh mục</span>
          <span className="st-selwrap">
            <select className="st-input" value={filters.categoryId} onChange={(e) => api.commit({ ...filters, categoryId: e.target.value }, 0)}>
              <option value="">Mọi danh mục</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <span aria-hidden="true"><ChevronDownIcon /></span>
          </span>
        </label>
        <label className="stB-field">
          <span className="st-visually-hidden">Thương hiệu</span>
          <span className="st-selwrap">
            <select className="st-input" value={filters.brand} onChange={(e) => api.commit({ ...filters, brand: e.target.value }, 0)}>
              <option value="">Mọi thương hiệu</option>
              {brands.map((b) => <option key={b.slug} value={b.slug}>{brandLabel(b.slug, b.name)}</option>)}
            </select>
            <span aria-hidden="true"><ChevronDownIcon /></span>
          </span>
        </label>
        <label className="stB-field">
          <span className="st-visually-hidden">Sắp xếp</span>
          <span className="st-selwrap">
            <select className="st-input" value={filters.sort} onChange={(e) => api.commit({ ...filters, sort: e.target.value }, 0)}>
              {SORTS.map((o) => <option key={o.v} value={o.v}>{o.label}</option>)}
            </select>
            <span aria-hidden="true"><ChevronDownIcon /></span>
          </span>
        </label>
        <BudgetPanel label={budgetLabel} extent={extent} value={priceValue} onCommit={commitPrice} />
        <button type="button" className="stB-filterbtn st-btn" onClick={() => setSheetOpen(true)}>
          Bộ lọc{chips.length ? ` · ${chips.length}` : ""}
        </button>
      </div>
      {chips.length ? (
        <div className="stB-chips">
          {chips.map((chip) => (
            <button
              key={chip.key}
              type="button"
              className="st-chip"
              aria-pressed="true"
              aria-label={`Bỏ điều kiện ${chip.label}`}
              onClick={() => {
                if (chip.key === "keyword") setDraft({ keyword: "" });
                api.commit(chip.clear, 0);
              }}
            >
              {chip.label} ×
            </button>
          ))}
          <button
            type="button"
            className="st-linkbtn"
            onClick={() => { setDraft({ keyword: "" }); api.commit({ brand: "", categoryId: "", keyword: "", minPrice: "", maxPrice: "", sort: filters.sort }, 0); }}
          >
            Xóa tất cả
          </button>
        </div>
      ) : null}
      <p className="st-lede" role="status">
        {loading ? "Đang tải sản phẩm…" : range ? `${range.from}–${range.to} trên ${data?.totalElements ?? 0} sản phẩm` : `${data?.totalElements ?? 0} sản phẩm`}
      </p>
      <section className="stB-results" aria-label="Danh sách sản phẩm" aria-busy={loading}>
        {error ? (
          <p className="st-err" role="alert">{error} <button type="button" className="st-linkbtn" onClick={api.retry}>Thử lại</button></p>
        ) : data && data.items.length === 0 ? (
          <div className="st-empty"><h2>Không có sản phẩm</h2><p>Thử nới ngân sách hoặc bỏ bớt điều kiện.</p></div>
        ) : data ? (
          <>
            <div className="stB-cards">
              {data.items.map((p) => <StudyCard key={p.id} product={p} />)}
            </div>
            {totalPages > 1 ? (
              <nav className="stB-pager" aria-label="Phân trang sản phẩm">
                <div className="stB-rangehead">
                  <span>Trang {page + 1} trên {totalPages}</span>
                  <span className="stB-posline" aria-hidden="true"><i style={{ width: `${((page + 1) / totalPages) * 100}%` }} /></span>
                </div>
                <div className="stB-nums">
                  <button type="button" className="stB-btn" aria-label="Trang trước" disabled={page <= 0 || loading} onClick={() => api.commit({ ...filters }, Math.max(0, page - 1))}><BackIcon /></button>
                  {window.map((t) =>
                    t.kind === "gap" ? (
                      <span key={t.key} className="stB-gap" aria-hidden="true">…</span>
                    ) : (
                      <button
                        key={t.page}
                        type="button"
                        className="stB-btn"
                        aria-label={`Trang ${t.page}`}
                        aria-current={t.page === page + 1 ? "page" : undefined}
                        disabled={t.page === page + 1 || loading}
                        onClick={() => api.commit({ ...filters }, t.page - 1)}
                      >
                        {t.page}
                      </button>
                    ),
                  )}
                  <button type="button" className="stB-btn" aria-label="Trang sau" disabled={page + 1 >= totalPages || loading} onClick={() => api.commit({ ...filters }, page + 1)}><ForwardIcon /></button>
                </div>
                <StudyJump totalPages={totalPages} page={page} onGoto={(n) => api.commit({ ...filters }, n)} id="b-jump" />
              </nav>
            ) : null}
          </>
        ) : null}
      </section>
      <FilterSheet open={sheetOpen} onClose={() => setSheetOpen(false)} title="Bộ lọc">
        <BSheetFields api={api} />
        <SheetFooter api={api} onClose={() => setSheetOpen(false)} />
      </FilterSheet>
    </div>
  );
}

function BSheetFields({ api }: { api: StudyApi }) {
  const { filters, draft, setDraft, brands, categories, extent } = api;
  const priceValue: PriceBounds = { lo: filters.minPrice ? Number(filters.minPrice) : null, hi: filters.maxPrice ? Number(filters.maxPrice) : null };
  return (
    <div className="stB-sheetgrid">
      <label className="stB-sheetfield">
        Tìm theo tên
        <input
          className="st-input"
          value={draft.keyword}
          maxLength={200}
          onChange={(e) => setDraft({ keyword: e.target.value })}
          onKeyDown={(e) => { if (e.key === "Enter") api.commit({ ...filters, keyword: draft.keyword.trim() }, 0); }}
        />
      </label>
      <label className="stB-sheetfield">
        Danh mục
        <select className="st-input" value={filters.categoryId} onChange={(e) => api.commit({ ...filters, categoryId: e.target.value }, 0)}>
          <option value="">Mọi danh mục</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </label>
      <label className="stB-sheetfield">
        Thương hiệu
        <select className="st-input" value={filters.brand} onChange={(e) => api.commit({ ...filters, brand: e.target.value }, 0)}>
          <option value="">Mọi thương hiệu</option>
          {brands.map((b) => <option key={b.slug} value={b.slug}>{brandLabel(b.slug, b.name)}</option>)}
        </select>
      </label>
      <label className="stB-sheetfield">
        Sắp xếp
        <select className="st-input" value={filters.sort} onChange={(e) => api.commit({ ...filters, sort: e.target.value }, 0)}>
          {SORTS.map((o) => <option key={o.v} value={o.v}>{o.label}</option>)}
        </select>
      </label>
      <section aria-label="Ngân sách">
        <h3 className="stB-sheet-h">Ngân sách</h3>
        <PriceRange
          extent={extent}
          value={priceValue}
          onCommit={(next) => api.commit({ ...filters, minPrice: next.lo === null ? "" : String(next.lo), maxPrice: next.hi === null ? "" : String(next.hi) }, 0)}
          idPrefix="bs-pr"
        />
      </section>
    </div>
  );
}

/** Panel neo desktop: Escape đóng + trả focus, click ngoài đóng. */
function BudgetPanel({ label, extent, value, onCommit }: { label: string; extent: PriceExtent | null; value: PriceBounds; onCommit: (n: PriceBounds) => void }) {
  const ref = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && el.open) {
        el.open = false;
        el.querySelector("summary")?.focus();
      }
    };
    const onDoc = (e: MouseEvent) => {
      if (el.open && !el.contains(e.target as Node)) el.open = false;
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onDoc);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onDoc);
    };
  }, []);
  return (
    <details className="stB-panel" ref={ref}>
      <summary>{label}</summary>
      <div className="stB-panelbody">
        <PriceRange extent={extent} value={value} onCommit={onCommit} idPrefix="b-pr" />
      </div>
    </details>
  );
}

