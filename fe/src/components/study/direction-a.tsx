"use client";

import { Children, useEffect, useRef, useState } from "react";
import { isMotionEnabled, readMotionPreference } from "@/lib/home-motion";
import { BackIcon, ChevronDownIcon, ForwardIcon } from "@/components/customer-catalog/catalog-icons";
import { brandLabel, type StudyApi } from "./use-study-catalog";
import { PriceRange, StudyCard, StudyJump, type PriceBounds } from "./study-bits";

const SORTS = [
  { v: "id,desc", label: "Mới nhất" },
  { v: "price,asc", label: "Giá thấp đến cao" },
  { v: "price,desc", label: "Giá cao đến thấp" },
  { v: "productName,asc", label: "Tên A–Z" },
  { v: "productName,desc", label: "Tên Z–A" },
];

/**
 * Hướng A — "Gian ngắm" (R2).
 * Ngân sách lên ĐẦU rail; danh mục gọn lưới 2 cột không khay cuộn;
 * mobile: thanh lọc gọn + tóm tắt trong viewport đầu, bộ lọc mở trong
 * sheet modal một cuộn. Phân trang soạn riêng: số hiện tại lớn + khung
 * góc viewfinder + jump (tái dùng pageWindow/validation/Back).
 */
export function DirectionA({ api }: { api: StudyApi }) {
  const { page, loading, data, display, refetching, slowLoad, error, range } = api;
  const [sheetOpen, setSheetOpen] = useState(false);

  useEffect(() => {
    document.title = "Nghiên cứu A — Gian ngắm | FaSearch";
  }, []);

  const activeCount =
    (api.filters.brand ? 1 : 0) +
    (api.filters.categoryId ? 1 : 0) +
    (api.filters.keyword ? 1 : 0) +
    (api.filters.minPrice || api.filters.maxPrice ? 1 : 0);

  return (
    <div className="stA">
      <div className="stA-head">
        <h1>Sản phẩm</h1>
        <p className="st-lede" role="status">
          {loading ? "Đang tải sản phẩm…" : range ? `${range.from}–${range.to} trên ${data?.totalElements ?? 0} sản phẩm` : `${data?.totalElements ?? 0} sản phẩm`}
        </p>
      </div>
      {/* Mục lọc gọn cho mobile: tóm tắt + mở sheet, nằm trong viewport đầu. */}
      <div className="stA-entry">
        <button type="button" className="st-btn stA-entrybtn" onClick={() => setSheetOpen(true)}>
          Lọc{activeCount ? ` · ${activeCount}` : ""}
        </button>
        <span className="stA-entrysum">{filterSummary(api)}</span>
      </div>
      <div className="stA-grid">
        <aside className="stA-rail" aria-label="Bộ lọc">
          <AFields api={api} idPrefix="a" />
        </aside>
        <section className="stA-results" aria-label="Danh sách sản phẩm" aria-busy={loading} data-refetching={refetching || undefined}>
          <ASearchSort api={api} idPrefix="a-tools" layout="toolbar" />
          {refetching ? <p className="st-updating" role="status">Đang cập nhật sản phẩm…</p> : null}
          {error && !display ? (
            <div className="st-empty" role="alert">
              <p className="st-err">{error}</p>
              <button type="button" className="st-linkbtn" onClick={api.retry}>Thử lại</button>
            </div>
          ) : null}
          {error && display ? (
            <p className="st-err" role="alert">{error} <button type="button" className="st-linkbtn" onClick={api.retry}>Thử lại</button></p>
          ) : null}
          {loading && !display && slowLoad ? (
            <div className="stA-cards st-skeleton" aria-hidden="true">
              {Array.from({ length: 6 }, (_, i) => <span key={i} className="st-sk" />)}
            </div>
          ) : null}
          {display && display.items.length === 0 && !loading ? (
            <div className="st-empty"><h2>Không có sản phẩm</h2><p>Thử nới ngân sách hoặc bỏ bớt điều kiện.</p></div>
          ) : display && display.items.length > 0 ? (
            <>
              <div className="stA-cards">
                {display.items.map((p) => <StudyCard key={p.id} product={p} />)}
              </div>
              {display.totalPages > 1 ? (
                <PagerA page={display.page} totalPages={display.totalPages} loading={loading} onGoto={(n) => api.commit({ ...api.filters }, n)} />
              ) : null}
            </>
          ) : null}
        </section>
      </div>
      <FilterSheet open={sheetOpen} onClose={() => setSheetOpen(false)} title="Bộ lọc">
        <AFields api={api} idPrefix="as" />
        <ASearchSort api={api} idPrefix="as-tools" layout="sheet" />
        <SheetFooter api={api} onClose={() => setSheetOpen(false)} />
      </FilterSheet>
    </div>
  );
}

function filterSummary(api: StudyApi): string {
  const parts: string[] = [];
  if (api.filters.categoryId) parts.push(api.categories.find((c) => String(c.id) === api.filters.categoryId)?.name ?? "Danh mục");
  if (api.filters.brand) parts.push(brandLabel(api.filters.brand, api.brands.find((b) => b.slug === api.filters.brand)?.name ?? api.filters.brand));
  if (api.filters.keyword) parts.push(`“${api.filters.keyword}”`);
  if (api.filters.minPrice || api.filters.maxPrice) parts.push("Có ngân sách");
  return parts.length ? parts.join(" · ") : "Tất cả sản phẩm";
}

/** Toàn bộ trường lọc A — dùng chung cho rail desktop và sheet mobile (một nguồn state). */
function AFields({ api, idPrefix }: { api: StudyApi; idPrefix: string }) {
  const { filters, brands, categories, extent } = api;
  const [catsOpen, setCatsOpen] = useState(false);
  const catRows = [{ id: "", name: "Tất cả" }, ...categories];
  const visibleCats = catsOpen || catRows.length <= 7 ? catRows : catRows.slice(0, 7);
  const priceValue: PriceBounds = { lo: filters.minPrice ? Number(filters.minPrice) : null, hi: filters.maxPrice ? Number(filters.maxPrice) : null };
  function commitPrice(next: PriceBounds) {
    api.commit(
      { ...filters, minPrice: next.lo === null ? "" : String(next.lo), maxPrice: next.hi === null ? "" : String(next.hi) },
      0,
    );
  }
  return (
    <>
      <section className="stA-sec" aria-labelledby={`${idPrefix}-price-h`}>
        <h2 id={`${idPrefix}-price-h`}>Ngân sách</h2>
        <PriceRange extent={extent} value={priceValue} onCommit={commitPrice} idPrefix={`${idPrefix}-pr`} />
      </section>
      <section className="stA-sec" aria-labelledby={`${idPrefix}-cat-h`}>
        <h2 id={`${idPrefix}-cat-h`}>Danh mục</h2>
        {/* R5 gọn + R7 nền trượt trang trí (chỉ con trỏ/chạm). */}
        <SlideOpts label="Danh mục" activeKey={filters.categoryId || "all"}>
          {visibleCats.map((c) => (
            <button
              key={c.id === "" ? "all" : c.id}
              type="button"
              role="radio"
              aria-checked={filters.categoryId === String(c.id)}
              className="stA-opt"
              data-active={filters.categoryId === String(c.id)}
              onClick={() => api.commit({ ...filters, categoryId: c.id === "" ? "" : String(c.id) }, 0)}
            >
              <span className="stA-corner" aria-hidden="true" />{c.name}
            </button>
          ))}
        </SlideOpts>
        {catRows.length > 7 ? (
          <button type="button" className="st-linkbtn" aria-expanded={catsOpen} onClick={() => setCatsOpen((v) => !v)}>
            {catsOpen ? "Thu gọn" : `Xem thêm ${catRows.length - 7} danh mục`}
          </button>
        ) : null}
      </section>
      <section className="stA-sec" aria-labelledby={`${idPrefix}-brand-h`}>
        <h2 id={`${idPrefix}-brand-h`}>Thương hiệu · {brands.length}</h2>
        <BrandSearch brands={brands} active={filters.brand} onPick={(slug) => api.commit({ ...filters, brand: slug }, 0)} idPrefix={idPrefix} />
      </section>
    </>
  );
}

/** Từ khóa + sắp xếp dùng chung: thanh công cụ trên lưới (desktop) và sheet mobile. */
function ASearchSort({ api, idPrefix, layout }: { api: StudyApi; idPrefix: string; layout: "toolbar" | "sheet" }) {
  const { filters, draft, setDraft, loading } = api;
  return (
    <div className={layout === "toolbar" ? "stA-tools" : "stA-sheetsearch"}>
      <form
        className="stA-search"
        onSubmit={(e) => { e.preventDefault(); api.commitKeywordNow(); }}
      >
        <label className="st-visually-hidden" htmlFor={`${idPrefix}-keyword`}>Tìm theo tên</label>
        <input
          id={`${idPrefix}-keyword`}
          className="st-input"
          value={draft.keyword}
          maxLength={200}
          placeholder="Áo thun…"
          onChange={(e) => setDraft({ keyword: e.target.value })}
          onCompositionStart={() => api.markComposing(true)}
          onCompositionEnd={(e) => { api.markComposing(false); setDraft({ keyword: (e.target as HTMLInputElement).value }); }}
        />
        <button className="st-btn" type="submit">Tìm</button>
      </form>
      <label className="stA-sortlabel">
        <span className="st-visually-hidden">Sắp xếp</span>
        <span className="st-selwrap">
          <select
            className="st-input"
            aria-label="Sắp xếp sản phẩm"
            value={filters.sort}
            disabled={loading}
            onChange={(e) => api.commit({ ...filters, sort: e.target.value }, 0)}
          >
            {SORTS.map((o) => <option key={o.v} value={o.v}>{o.label}</option>)}
          </select>
          <span aria-hidden="true"><ChevronDownIcon /></span>
        </span>
      </label>
    </div>
  );
}

/**
 * R7: nhóm radio có lớp nền trượt theo lựa chọn — CHỈ trang trí khi dùng
 * con trỏ/chạm. Bàn phím/reduced-motion: snap ngay, vòng focus tức thì.
 * Không trượt khi render đầu, khi lọc làm ẩn mục active, hay ma quỷ.
 */
function optionFingerprint(children: React.ReactNode): string {
  return Children.toArray(children)
    .map((c) => String((c as React.ReactElement | null)?.key ?? (c as { props?: { children?: unknown } } | null)?.props ?? "?"))
    .join("|");
}

function SlideOpts({ label, activeKey, children }: { label: string; activeKey: string; children: React.ReactNode }) {
  const boxRef = useRef<HTMLDivElement>(null);
  const bgRef = useRef<HTMLSpanElement>(null);
  const prevKey = useRef<string | null>(null);
  const prevFp = useRef<string | null>(null);
  const lastW = useRef(0);
  const pointerMode = useRef(false);
  const [motionOK, setMotionOK] = useState(true);
  const fingerprint = optionFingerprint(children);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setMotionOK(isMotionEnabled(readMotionPreference(window.localStorage), mq.matches));
    apply();
    const onStorage = () => apply();
    mq.addEventListener?.("change", apply);
    window.addEventListener("storage", onStorage);
    return () => {
      mq.removeEventListener?.("change", apply);
      window.removeEventListener("storage", onStorage);
    };
  }, []);
  useEffect(() => {
    const box = boxRef.current;
    const bg = bgRef.current;
    if (!box || !bg) return;
    const place = (animate: boolean) => {
      const el = box.querySelector<HTMLElement>("[data-active='true']");
      const active = el && el.offsetParent !== null ? el : null;
      if (!active) {
        bg.style.opacity = "0";
        return;
      }
      if (!animate) bg.style.transition = "none";
      bg.style.opacity = "1";
      bg.style.transform = `translateY(${active.offsetTop}px)`;
      bg.style.height = `${active.offsetHeight}px`;
      if (!animate) {
        void bg.offsetWidth;
        bg.style.transition = "";
      }
    };
    const listChanged = prevFp.current !== null && prevFp.current !== fingerprint;
    const moved = prevKey.current !== null && prevKey.current !== activeKey;
    // R8-F-R7-GHOST: danh sach doi (ke ca cung so luong) hoac khong phai
    // pointer/tat motion => snap, khong bao gio truot ma.
    const animate = pointerMode.current && motionOK && moved && !listChanged;
    place(animate);
    prevKey.current = activeKey;
    prevFp.current = fingerprint;
    lastW.current = box.offsetWidth;
    // R8: ResizeObserver phat hien ngay lan observe dau — chi re-place khi
    // chieu rong thuc su doi, neu khong se giet transition vua bat dau.
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(() => {
      if (Math.abs(box.offsetWidth - lastW.current) < 1) return;
      lastW.current = box.offsetWidth;
      place(false);
    }) : null;
    if (ro) ro.observe(box);
    return () => ro?.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeKey, fingerprint, motionOK]);
  return (
    <div
      className="stA-opts stA-optsSlide"
      role="radiogroup"
      aria-label={label}
      ref={boxRef}
      onPointerDown={() => { pointerMode.current = true; }}
      onTouchStart={() => { pointerMode.current = true; }}
      onKeyDown={() => { pointerMode.current = false; }}
    >
      <span className="stA-selbg" aria-hidden="true" ref={bgRef} />
      {children}
    </div>
  );
}

function BrandSearch({ brands, active, onPick, idPrefix }: { brands: { slug: string; name: string }[]; active: string; onPick: (slug: string) => void; idPrefix: string }) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const query = q.trim().toLowerCase();
  const matches = brands.filter((b) => !query || brandLabel(b.slug, b.name).toLowerCase().includes(query));
  const visible = query || open ? matches : matches.slice(0, 8);
  return (
    <div className="stA-brandsearch">
      <label className="st-visually-hidden" htmlFor={`${idPrefix}-brandq`}>Tìm thương hiệu</label>
      <input id={`${idPrefix}-brandq`} className="st-input" type="search" placeholder="Tìm thương hiệu…" value={q} onChange={(e) => setQ(e.target.value)} />
      <SlideOpts label="Thương hiệu" activeKey={active || "all"}>
        <button type="button" role="radio" aria-checked={active === ""} className="stA-opt" data-active={active === ""} onClick={() => onPick("")}>
          <span className="stA-corner" aria-hidden="true" />Tất cả
        </button>
        {visible.map((b) => (
          <button
            key={b.slug}
            type="button"
            role="radio"
            aria-checked={active === b.slug}
            className="stA-opt"
            data-active={active === b.slug}
            onClick={() => onPick(b.slug)}
          >
            <span className="stA-corner" aria-hidden="true" />{brandLabel(b.slug, b.name)}
          </button>
        ))}
      </SlideOpts>
      {!query && matches.length > 8 ? (
        <button type="button" className="st-linkbtn" aria-expanded={open} onClick={() => setOpen(!open)}>
          {open ? "Thu gọn" : `Xem thêm ${matches.length - 8} hãng`}
        </button>
      ) : null}
    </div>
  );
}

/** R7: pager gọn — giữ số hiện tại lớn + khung góc viewfinder + vạch vị trí
    + prev/next + jump; BỎ dải số trang thứ hai (trùng readout). */
function PagerA({ page, totalPages, loading, onGoto }: { page: number; totalPages: number; loading: boolean; onGoto: (p0: number) => void }) {
  function goto(p0: number) {
    if (p0 === page) return;
    onGoto(p0);
  }
  return (
    <nav className="stA-pager" aria-label="Phân trang sản phẩm">
      <div className="stA-pagerow">
        <button type="button" className="stA-pagebtn" aria-label="Trang trước" disabled={page <= 0 || loading} onClick={() => goto(Math.max(0, page - 1))}>
          <BackIcon />
        </button>
        <span className="stA-current" aria-current="page" aria-label={`Trang ${page + 1} trên ${totalPages}`}>
          <span className="stA-corner" aria-hidden="true" />{page + 1}
        </span>
        <span className="stA-total">/ {totalPages}</span>
        <span className="stA-posline" aria-hidden="true"><i style={{ width: `${((page + 1) / totalPages) * 100}%` }} /></span>
        <button type="button" className="stA-pagebtn" aria-label="Trang sau" disabled={page + 1 >= totalPages || loading} onClick={() => goto(page + 1)}>
          <ForwardIcon />
        </button>
      </div>
      <div className="stA-pagerow">
        <StudyJump totalPages={totalPages} page={page} onGoto={goto} id="a-jump" />
      </div>
    </nav>
  );
}

/** Sheet modal mobile: một cuộn duy nhất, Escape/Focus gốc đúng chuẩn dialog. */
export function FilterSheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLElement | null>(null);
  useEffect(() => {
    const dlg = ref.current;
    if (!dlg) return;
    if (open) {
      trigger.current = document.activeElement as HTMLElement | null;
      if (!dlg.open) dlg.showModal();
    } else if (dlg.open) {
      dlg.close();
    }
  }, [open ]);
  useEffect(() => {
    const dlg = ref.current;
    if (!dlg) return;
    const onCloseEv = () => {
      // Đóng bằng Escape/backdrop: trả focus về nút đã mở.
      trigger.current?.focus?.();
      onClose();
    };
    dlg.addEventListener("close", onCloseEv);
    return () => dlg.removeEventListener("close", onCloseEv);
  }, [onClose]);
  return (
    <dialog ref={ref} className="st-sheet" aria-label={title} onClick={(e) => { if (e.target === e.currentTarget) ref.current?.close(); }}>
      <div className="st-sheet-head">
        <strong>{title}</strong>
        <button type="button" className="st-btn" onClick={() => ref.current?.close()}>Đóng</button>
      </div>
      <div className="st-sheet-body">{children}</div>
    </dialog>
  );
}

export function SheetFooter({ api, onClose }: { api: StudyApi; onClose: () => void }) {
  const { data, loading } = api;
  return (
    <div className="st-sheet-foot">
      <button type="button" className="st-btn st-btn-primary" onClick={onClose} disabled={loading}>
        {loading ? "Đang tải…" : `Xem ${data?.totalElements ?? 0} sản phẩm`}
      </button>
    </div>
  );
}
