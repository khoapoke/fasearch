"use client";

import { useEffect, useId, useRef, useState } from "react";
import { getStock, getStockPage, type Stock } from "@/lib/admin-stock-client";

export type SkuPickerMode = "any" | "inStock";

type Props = {
  /** Input id (keeps the surrounding <label htmlFor> working, e.g. imp-sku-1). */
  id: string;
  /** Selected skuId as a string; "" means nothing selected. */
  value: string;
  onChange: (skuId: string, stock: Stock | null) => void;
  /** "any": every SKU selectable (import/stocktake). "inStock": zero-stock options are visibly disabled (export). */
  mode?: SkuPickerMode;
  placeholder?: string;
};

const PAGE_SIZE = 20;
const DEBOUNCE_MS = 300;

export function skuLabel(s: Stock): string {
  const variant = [s.color, s.size].filter(Boolean).join("/");
  return `${s.skuId} · ${s.productName}${variant ? ` · ${variant}` : ""}`;
}

function stockHint(s: Stock): string {
  const avail = s.availableStock === null || s.availableStock === undefined ? "?" : String(s.availableStock);
  const phys = s.physicalStock === null || s.physicalStock === undefined ? "?" : String(s.physicalStock);
  return `khả dụng ${avail} · vật lý ${phys}`;
}

const isDisabled = (mode: SkuPickerMode, s: Stock): boolean =>
  mode === "inStock" && (s.availableStock ?? 0) <= 0;

/**
 * Searchable SKU picker for the Admin B receipt/stocktake forms.
 * Type-ahead by numeric SKU id / barcode (server `sku` param) or by product
 * name / colour / size / barcode text (server `keyword` param), debounced.
 * Native-input keyboard support: ArrowUp/Down moves, Enter selects, Escape closes.
 */
export function SkuPicker({ id, value, onChange, mode = "any", placeholder }: Props) {
  const listId = useId();
  const wrap = useRef<HTMLDivElement>(null);
  const abort = useRef<AbortController | null>(null);
  const version = useRef(0);
  const silentQuery = useRef(false);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Stock | null>(null);
  const [options, setOptions] = useState<Stock[]>([]);
  const [total, setTotal] = useState<number | null>(null);
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [pendingResolve, setPendingResolve] = useState<string | null>(() => value || null);
  const [prevValue, setPrevValue] = useState(value);
  const emptyQuery = query.trim().length === 0;

  // Render-phase sync for parent-driven value changes (form reset, ?sku=
  // deep link): adjusting state during render is the documented alternative
  // to setState-in-effect, and never clobbers in-progress typing because it
  // only runs when the value prop itself changed.
  if (prevValue !== value) {
    setPrevValue(value);
    if (!value) {
      setSelected(null);
      setQuery("");
      setPendingResolve(null);
    } else if (!selected || String(selected.skuId) !== value) {
      setPendingResolve(value);
    }
  }

  // Resolve an externally provided skuId to its display row.
  useEffect(() => {
    if (!pendingResolve) return;
    const wanted = pendingResolve;
    let alive = true;
    getStock(wanted)
      .then((s) => {
        if (!alive) return;
        silentQuery.current = true;
        setSelected(s);
        setQuery(skuLabel(s));
        setPendingResolve(null);
      })
      .catch(() => {
        if (!alive) return;
        silentQuery.current = true;
        setSelected(null);
        setQuery(wanted);
        setPendingResolve(null);
      });
    return () => {
      alive = false;
    };
  }, [pendingResolve]);

  // Debounced server-side search. Programmatic query updates (selection,
  // clear, external resolve) set silentQuery so they never trigger a fetch.
  useEffect(() => {
    if (silentQuery.current) {
      silentQuery.current = false;
      return;
    }
    const q = query.trim();
    const t = window.setTimeout(() => {
      void (async () => {
        const v = ++version.current;
        abort.current?.abort();
        const c = new AbortController();
        abort.current = c;
        setLoading(true);
        setFailed(false);
        try {
          const params = new URLSearchParams({ page: "0", size: String(PAGE_SIZE) });
          if (/^\d+$/.test(q)) params.set("sku", q);
          else if (q) params.set("keyword", q);
          const page = await getStockPage(params.toString(), c.signal);
          if (version.current !== v) return;
          setOptions(page.content);
          setTotal(page.totalElements);
          setHighlight(null);
        } catch (e) {
          if (e instanceof DOMException && e.name === "AbortError") return;
          if (version.current !== v) return;
          setFailed(true);
          setOptions([]);
          setTotal(null);
        } finally {
          if (version.current === v) setLoading(false);
        }
      })();
    }, DEBOUNCE_MS);
    return () => window.clearTimeout(t);
  }, [query, mode]);

  useEffect(() => () => abort.current?.abort(), []);

  function move(delta: 1 | -1) {
    if (!options.length) return;
    setOpen(true);
    setHighlight((h) => {
      const n = options.length;
      let i = h === null ? (delta === 1 ? -1 : n) : h;
      for (let step = 0; step < n; step++) {
        i = (i + delta + n) % n;
        if (!isDisabled(mode, options[i])) return i;
      }
      return h;
    });
  }

  function choose(s: Stock) {
    if (isDisabled(mode, s)) return;
    silentQuery.current = true;
    setSelected(s);
    setQuery(skuLabel(s));
    setOpen(false);
    setHighlight(null);
    onChange(String(s.skuId), s);
  }

  function clear() {
    silentQuery.current = true;
    setSelected(null);
    setQuery("");
    setOptions([]);
    setTotal(null);
    setOpen(false);
    setHighlight(null);
    onChange("", null);
    wrap.current?.querySelector("input")?.focus();
  }

  const activeId = highlight !== null && options[highlight] ? `${listId}-opt-${options[highlight].skuId}` : undefined;

  return (
    <div ref={wrap} className="sku-picker" data-sku-picker={id}>
      <div className="sku-picker-input-wrap">
        <input
          id={id}
          className="catalog-input"
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-activedescendant={activeId}
          aria-autocomplete="list"
          autoComplete="off"
          spellCheck={false}
          placeholder={placeholder ?? "Gõ mã SKU, tên sản phẩm hoặc barcode…"}
          value={query}
          data-selected-sku={selected ? String(selected.skuId) : ""}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            setHighlight(null);
          }}
          onFocus={() => setOpen(true)}
          onBlur={(e) => {
            if (!e.currentTarget.parentElement?.parentElement?.contains(e.relatedTarget as Node)) setOpen(false);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              move(1);
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              move(-1);
            } else if (e.key === "Enter") {
              if (open && highlight !== null && options[highlight] && !isDisabled(mode, options[highlight])) {
                e.preventDefault();
                choose(options[highlight]);
              }
            } else if (e.key === "Escape") {
              setOpen(false);
              setHighlight(null);
            }
          }}
        />
        {selected ? (
          <button type="button" className="sku-picker-clear" aria-label="Xóa SKU đã chọn" onClick={clear}>
            ×
          </button>
        ) : null}
      </div>
      {selected ? <small className="meta" data-sku-selected-hint={selected.skuId}>{stockHint(selected)}</small> : null}
      {open ? (
        <ul id={listId} className="sku-picker-list" role="listbox" aria-label="Kết quả tìm SKU" data-sku-options={id}>
          {loading && !options.length ? <li className="sku-picker-empty" role="presentation">Đang tìm…</li> : null}
          {failed ? <li className="sku-picker-empty" role="presentation">Không tải được danh sách SKU.</li> : null}
          {!loading && !failed && !options.length ? (
            <li className="sku-picker-empty" role="presentation">
              {emptyQuery ? "Gõ để tìm SKU trong toàn catalog." : "Không tìm thấy SKU phù hợp. Thử mã SKU, tên sản phẩm hoặc barcode khác."}
            </li>
          ) : null}
          {options.map((s) => {
            const disabled = isDisabled(mode, s);
            const active = highlight !== null && options[highlight]?.skuId === s.skuId;
            return (
              <li
                key={s.skuId}
                id={`${listId}-opt-${s.skuId}`}
                role="option"
                aria-selected={selected?.skuId === s.skuId}
                aria-disabled={disabled || undefined}
                data-sku-option={s.skuId}
                data-sku-disabled={disabled ? "1" : undefined}
                className={`sku-picker-option${active ? " highlighted" : ""}${disabled ? " disabled" : ""}`}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => choose(s)}
                onMouseMove={() => {
                  if (!disabled) setHighlight(options.findIndex((o) => o.skuId === s.skuId));
                }}
              >
                <span>{skuLabel(s)}</span>
                <span className="sku-picker-stock">
                  {stockHint(s)}
                  {s.barcode ? ` · ${s.barcode}` : ""}
                  {disabled ? " · Hết hàng" : ""}
                </span>
              </li>
            );
          })}
        </ul>
      ) : null}
      {open && total !== null && !loading && !failed && options.length ? (
        <small className="meta" role="status">
          {total > options.length ? `Hiện ${options.length} trong ${total} kết quả — gõ thêm để thu hẹp.` : `${total} kết quả.`}
        </small>
      ) : null}
    </div>
  );
}
