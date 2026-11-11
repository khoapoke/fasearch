"use client";

import { useEffect, useRef, useState } from "react";
import type { Stock } from "@/lib/admin-stock-client";
import { isDisabled, skuLabel, type SkuPickerMode } from "./sku-picker";
import { useToast } from "./toast";
import "./s2.css";

export type ScanResult = { ok: true; message: string } | { ok: false; message: string };

/** Exact barcode, then SKU id. Null when no active SKU matches. Works for SKUs that have no stock row yet (stock 0). */
export async function resolveScan(code: string, signal?: AbortSignal): Promise<Stock | null> {
  const r = await fetch(`/api/admin/catalog/variants/scan-lookup?code=${encodeURIComponent(code)}`, { cache: "no-store", signal });
  if (r.status === 404) return null;
  let j: { success?: boolean; result?: Stock } | null = null;
  try { j = await r.json(); } catch {}
  if (!r.ok || j?.success !== true || !j.result) throw new Error("Không tra cứu được mã.");
  return j.result;
}

type Props = {
  /** Same meaning as the SKU picker: "inStock" refuses SKUs with no available stock. */
  mode: SkuPickerMode;
  /** The page decides what a scan does (add a line, add one to its quantity). Return the result to show. */
  onScan: (stock: Stock) => ScanResult;
  disabled?: boolean;
  id?: string;
};

/**
 * "Quét Barcode": a USB scanner types the code and presses Enter. Focused on page load.
 * Enter never submits the surrounding form.
 */
export function BarcodeScanInput({ mode, onScan, disabled, id = "scan-input" }: Props) {
  const toast = useToast();
  const ref = useRef<HTMLInputElement>(null);
  const abort = useRef<AbortController | null>(null);
  const queue = useRef<string[]>([]);
  const working = useRef(false);
  const [value, setValue] = useState("");
  const [state, setState] = useState<"idle" | "busy" | "ok" | "bad">("idle");
  const [message, setMessage] = useState("");
  const onScanRef = useRef(onScan);
  useEffect(() => { onScanRef.current = onScan; });

  useEffect(() => { if (!disabled) ref.current?.focus(); return () => abort.current?.abort(); }, [disabled]);

  async function run() {
    if (working.current) return;
    working.current = true;
    setState("busy");
    while (queue.current.length) {
      const code = queue.current.shift() as string;
      const c = new AbortController();
      abort.current = c;
      try {
        const stock = await resolveScan(code, c.signal);
        if (!stock) { fail(`Không tìm thấy SKU cho mã ${code}.`); continue; }
        if (isDisabled(mode, stock) && (stock.availableStock ?? 0) <= 0) { fail(`${skuLabel(stock)} đã hết hàng khả dụng.`); continue; }
        const result = onScanRef.current(stock);
        if (result.ok) { setState("ok"); setMessage(result.message); } else fail(result.message);
      } catch (e) {
        if (e instanceof DOMException && e.name === "AbortError") { working.current = false; return; }
        fail("Không tra cứu được mã. Thử quét lại.");
      }
    }
    working.current = false;
    ref.current?.focus();
  }

  function fail(msg: string) {
    setState("bad"); setMessage(msg); toast.error(msg);
  }

  function submit() {
    const code = value.trim();
    if (!code) return;
    setValue("");
    queue.current.push(code);
    void run();
  }

  return (
    <div className="s2-scan" role="group" aria-label="Quét Barcode">
      <label htmlFor={id}>Quét Barcode</label>
      <input
        ref={ref}
        id={id}
        className={`catalog-input${state === "bad" ? " s2-bad" : state === "ok" ? " s2-good" : ""}`}
        type="text"
        inputMode="text"
        autoComplete="off"
        spellCheck={false}
        disabled={disabled}
        aria-invalid={state === "bad"}
        aria-describedby={`${id}-msg`}
        placeholder="Quét hoặc gõ Barcode / SKU rồi nhấn Enter"
        value={value}
        onChange={(e) => { setValue(e.target.value); if (state !== "busy") setState("idle"); }}
        onKeyDown={(e) => {
          if (e.key === "Enter") { e.preventDefault(); e.stopPropagation(); submit(); }
        }}
      />
      <span id={`${id}-msg`} className={`s2-scan-msg${state === "ok" ? " ok" : state === "bad" ? " err" : ""}`} role={state === "bad" ? "alert" : "status"} aria-live="polite">{message}</span>
    </div>
  );
}
