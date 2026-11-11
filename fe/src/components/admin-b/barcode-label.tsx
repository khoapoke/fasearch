"use client";

import { barcodePath, barcodeModules, encodeBarcode, type BarcodeBars } from "@/lib/barcode";
import type { LabelItem } from "@/lib/admin-label-client";
import "./s2.css";

export type LabelSizeKey = "r35" | "r50" | "a4";
export type LabelSize = { key: LabelSizeKey; name: string; detail: string; cellW: number; cellH: number; pad: number; cols: number; rows: number; pageW: number; pageH: number };

/** Millimetres. Roll sizes: page = one row of labels; A4: 3 x 8 grid of 70 x 37 mm cells, no page margin. */
export const LABEL_SIZES: Record<LabelSizeKey, LabelSize> = {
  r35: { key: "r35", name: "35 × 22 mm", detail: "Cuộn tem, 2 tem một hàng", cellW: 35, cellH: 22, pad: 1, cols: 2, rows: 1, pageW: 70, pageH: 22 },
  r50: { key: "r50", name: "50 × 30 mm", detail: "Cuộn tem, 1 tem một hàng", cellW: 50, cellH: 30, pad: 1.5, cols: 1, rows: 1, pageW: 50, pageH: 30 },
  a4: { key: "a4", name: "A4 3 × 8", detail: "24 tem trên một tờ A4", cellW: 70, cellH: 37, pad: 2.5, cols: 3, rows: 8, pageW: 210, pageH: 297 },
};

/** Smallest narrow-bar width (mm) that cheap 203 dpi printers and phone scanners still read reliably. */
export const MIN_MODULE_MM = 0.15;

export const moduleWidthMm = (bars: BarcodeBars, size: LabelSize) => (size.cellW - size.pad * 2) / barcodeModules(bars);

export const formatLabelPrice = (v: number) => `${Math.round(v).toLocaleString("vi-VN")}đ`;

export function BarcodeSvg({ bars, className }: { bars: BarcodeBars; className?: string }) {
  const { d, total } = barcodePath(bars);
  return (
    <svg className={className} viewBox={`0 0 ${total} 1`} preserveAspectRatio="none" shapeRendering="crispEdges" role="img" aria-label={`Barcode ${bars.text}`}>
      <path fill="#000" d={d} />
    </svg>
  );
}

export function BarcodeLabel({ item }: { item: LabelItem }) {
  const bars = encodeBarcode(item.barcode);
  const variant = [item.color, item.size].filter(Boolean).join(" / ");
  return (
    <div className="s2-cell">
      <div className="s2-name">{item.productName}</div>
      <div className="s2-meta"><span>{variant || " "}</span><span>SKU {item.skuId}</span></div>
      <div className="s2-price">{formatLabelPrice(item.price)}</div>
      {bars ? <BarcodeSvg bars={bars} className="s2-bars" /> : <div className="s2-bars s2-nobars">Không in được Barcode</div>}
      <div className="s2-code">{item.barcode}</div>
    </div>
  );
}

export type LabelCell = LabelItem | null;

/** Split cells into printed pages: roll sizes put `cols` labels per page, A4 puts 24. */
export function paginate(cells: LabelCell[], size: LabelSize): LabelCell[][] {
  const per = size.cols * size.rows;
  const pages: LabelCell[][] = [];
  for (let i = 0; i < cells.length; i += per) {
    const page = cells.slice(i, i + per);
    while (size.key !== "a4" && page.length < per) page.push(null);
    pages.push(page);
  }
  return pages;
}

export function LabelPages({ pages, size, className }: { pages: LabelCell[][]; size: LabelSize; className?: string }) {
  return (
    <div
      className={`s2-sheet s2-${size.key}${className ? ` ${className}` : ""}`}
      style={{ "--w": `${size.cellW}mm`, "--h": `${size.cellH}mm`, "--pad": `${size.pad}mm`, "--cols": size.cols, "--pw": `${size.pageW}mm`, "--ph": `${size.pageH}mm` } as React.CSSProperties}
    >
      {pages.map((page, pi) => (
        <div className="s2-page" key={pi}>
          {page.map((cell, ci) => (cell ? <BarcodeLabel key={ci} item={cell} /> : <div key={ci} className="s2-cell s2-blank" aria-hidden="true" />))}
        </div>
      ))}
    </div>
  );
}
