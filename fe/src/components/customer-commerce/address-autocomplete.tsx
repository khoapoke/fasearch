"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { DeliveryLocation } from "./location-picker";

type Suggestion = { placeId: string; label: string };
type Props = {
  id: string;
  value: string;
  invalid?: boolean;
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  "aria-required"?: boolean | "true" | "false";
  "aria-invalid"?: boolean | "true" | "false";
  "aria-describedby"?: string;
  /** Người dùng gõ tay: cha nên bỏ ghim cũ vì địa chỉ đã đổi. */
  onText: (text: string) => void;
  /** Chọn một gợi ý: địa chỉ chuẩn hoá + toạ độ để tính phí giao chính xác. */
  onPick: (address: string, location: DeliveryLocation) => void;
  onLocate: (location: DeliveryLocation) => void;
};

const MIN_CHARS = 4;
const DEBOUNCE_MS = 500;

/**
 * Một ô địa chỉ duy nhất: gõ là tự gợi ý (debounce 500ms, ≥4 ký tự, có cache),
 * chọn gợi ý là tự ghim vị trí. Combobox ARIA, điều khiển được bằng bàn phím.
 */
export function AddressAutocomplete({ id, value, invalid, required, minLength, maxLength, onText, onPick, onLocate, ...aria }: Props & { [key: string]: unknown }) {
  const ariaRequired = (aria as Record<string, unknown>)["aria-required"] as boolean | "true" | "false" | undefined;
  const ariaInvalid = (aria as Record<string, unknown>)["aria-invalid"] as boolean | "true" | "false" | undefined;
  const ariaDescribedBy = (aria as Record<string, unknown>)["aria-describedby"] as string | undefined;
  const listId = useId();
  const [items, setItems] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const cache = useRef(new Map<string, Suggestion[]>());
  const timer = useRef<number | null>(null);
  const ctrl = useRef<AbortController | null>(null);

  useEffect(() => () => {
    if (timer.current !== null) window.clearTimeout(timer.current);
    ctrl.current?.abort();
  }, []);

  function show(list: Suggestion[]) {
    setItems(list);
    setOpen(list.length > 0);
    setActive(-1);
  }

  async function run(query: string) {
    const c = new AbortController();
    ctrl.current = c;
    setBusy(true);
    try {
      const r = await fetch(`/api/customer-commerce/maps/autocomplete?input=${encodeURIComponent(query)}`, { cache: "no-store", signal: c.signal });
      const j = await r.json().catch(() => ({}));
      if (c.signal.aborted) return;
      if (!r.ok) {
        show([]);
        setStatus("Chưa gợi ý được địa chỉ lúc này. Bạn cứ nhập đầy đủ, phí giao sẽ tính theo tỉnh/quận.");
        return;
      }
      const list: Suggestion[] = Array.isArray(j.result) ? j.result.slice(0, 6) : [];
      cache.current.set(query.toLowerCase(), list);
      show(list);
      setStatus(list.length ? "" : "Không thấy gợi ý phù hợp. Kiểm tra lại địa chỉ hoặc ghim trên bản đồ.");
    } catch {
      if (!c.signal.aborted) setStatus("Không tải được gợi ý địa chỉ.");
    } finally {
      if (ctrl.current === c) setBusy(false);
    }
  }

  function schedule(text: string) {
    if (timer.current !== null) window.clearTimeout(timer.current);
    ctrl.current?.abort();
    setBusy(false);
    const query = text.trim();
    if (query.length < MIN_CHARS) {
      show([]);
      setStatus("");
      return;
    }
    const hit = cache.current.get(query.toLowerCase());
    if (hit) {
      show(hit);
      return;
    }
    timer.current = window.setTimeout(() => {
      timer.current = null;
      void run(query);
    }, DEBOUNCE_MS);
  }

  async function pick(s: Suggestion) {
    setOpen(false);
    setBusy(true);
    try {
      const r = await fetch(`/api/customer-commerce/maps/geocode?placeId=${encodeURIComponent(s.placeId)}`, { cache: "no-store" });
      const j = await r.json();
      if (!r.ok) throw new Error();
      onPick(j.result.formattedAddress || s.label, { deliveryLatitude: j.result.latitude, deliveryLongitude: j.result.longitude });
      setStatus("");
    } catch {
      setStatus("Không định vị được địa chỉ này. Bạn có thể ghim trên bản đồ.");
    } finally {
      setBusy(false);
    }
  }

  function locate() {
    if (!navigator.geolocation) {
      setStatus("Trình duyệt chưa hỗ trợ định vị. Bạn có thể ghim trên bản đồ.");
      return;
    }
    setStatus("Đang lấy vị trí…");
    navigator.geolocation.getCurrentPosition(
      (p) => {
        onLocate({ deliveryLatitude: Number(p.coords.latitude.toFixed(6)), deliveryLongitude: Number(p.coords.longitude.toFixed(6)) });
        setStatus("Đã lấy vị trí hiện tại. Nhớ ghi rõ số nhà trong ô địa chỉ nhé.");
      },
      () => setStatus("Không lấy được vị trí. Hãy cho phép định vị hoặc ghim trên bản đồ."),
      { timeout: 10000 },
    );
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open || items.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => (i + 1) % items.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => (i <= 0 ? items.length - 1 : i - 1));
    } else if (e.key === "Enter" && active >= 0) {
      e.preventDefault();
      void pick(items[active]);
    } else if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
    }
  }

  return (
    <div className="co-addr">
      <div className="co-addr-box">
        <input
          id={id}
          className="checkout-input co-addr-input"
          role="combobox"
          aria-expanded={open}
          aria-controls={open ? listId : undefined}
          aria-autocomplete="list"
          aria-activedescendant={open && active >= 0 ? `${listId}-${active}` : undefined}
          aria-invalid={ariaInvalid ?? (invalid || undefined)}
          aria-required={ariaRequired}
          aria-describedby={ariaDescribedBy}
          required={required}
          minLength={minLength}
          maxLength={maxLength}
          autoComplete="street-address"
          placeholder="Số nhà, tên đường, phường, quận…"
          value={value}
          onChange={(e) => { onText(e.target.value); schedule(e.target.value); }}
          onKeyDown={onKeyDown}
          onFocus={() => { if (items.length) setOpen(true); }}
          onBlur={() => window.setTimeout(() => setOpen(false), 120)}
        />
        {busy ? <span className="co-addr-spin" aria-hidden="true" /> : null}
      </div>
      {open ? (
        <ul id={listId} role="listbox" className="co-addr-list" aria-label="Địa chỉ gợi ý">
          {items.map((s, i) => (
            <li
              key={s.placeId}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              className={i === active ? "is-active" : undefined}
              onMouseDown={(e) => { e.preventDefault(); void pick(s); }}
            >
              {s.label}
            </li>
          ))}
        </ul>
      ) : null}
      <div className="co-addr-tools">
        <button type="button" className="co-linkbtn" onClick={locate}>
          <span aria-hidden="true">◎</span> Dùng vị trí hiện tại
        </button>
      </div>
      {status ? <p className="co-muted" role="status">{status}</p> : null}
    </div>
  );
}
