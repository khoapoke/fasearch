"use client";

import { useEffect, useId, useRef, useState } from "react";
import { formatNumber } from "@/lib/admin-format";
import type { Tone } from "./status-badge";

export type BarDatum = {
  key: string;
  /** Short axis label, for example "07/11". */
  label: string;
  value: number;
  /** Order count (or any second figure) shown in the tooltip. */
  count?: number;
  /** Optional previous-period value drawn as a gray bar behind. */
  compare?: number;
  /** Replaces the default tooltip text. */
  tooltip?: string;
};

/** 1.250.000 -> "1,3 tr", 850.000 -> "850 k", 1.200.000.000 -> "1,2 tỷ". */
export function compactVnd(v: number): string {
  const abs = Math.abs(v);
  const one = (n: number) => n.toLocaleString("vi-VN", { maximumFractionDigits: 1 });
  if (abs >= 1e9) return `${one(v / 1e9)} tỷ`;
  if (abs >= 1e6) return `${one(v / 1e6)} tr`;
  if (abs >= 1e3) return `${one(v / 1e3)} k`;
  return one(v);
}

/** Round, readable ticks: 0, 50, 100 instead of 0, 58, 116. */
export function niceTicks(max: number, target = 4): number[] {
  if (!Number.isFinite(max) || max <= 0) return [0, 1];
  const raw = max / target;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const f = raw / pow;
  const step = (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * pow;
  const top = Math.ceil(max / step) * step;
  const out: number[] = [];
  for (let v = 0; v <= top + step / 1000; v += step) out.push(Math.round(v * 1e6) / 1e6);
  return out;
}

export type Granularity = "DAY" | "WEEK" | "MONTH" | "YEAR";

function parseIso(s: string): Date {
  const [y, m, d] = s.slice(0, 10).split("-").map(Number);
  return new Date(Date.UTC(y, (m || 1) - 1, d || 1));
}
const iso = (d: Date) => d.toISOString().slice(0, 10);

function bucketStart(d: Date, g: Granularity): Date {
  const x = new Date(d);
  if (g === "WEEK") x.setUTCDate(x.getUTCDate() - ((x.getUTCDay() + 6) % 7));
  if (g === "MONTH") x.setUTCDate(1);
  if (g === "YEAR") { x.setUTCMonth(0); x.setUTCDate(1); }
  return x;
}

function nextBucket(d: Date, g: Granularity): Date {
  const x = new Date(d);
  if (g === "DAY") x.setUTCDate(x.getUTCDate() + 1);
  else if (g === "WEEK") x.setUTCDate(x.getUTCDate() + 7);
  else if (g === "MONTH") x.setUTCMonth(x.getUTCMonth() + 1);
  else x.setUTCFullYear(x.getUTCFullYear() + 1);
  return x;
}

/** "2026-11-07" -> "07/11" (DAY, WEEK), "11/2026" (MONTH), "2026" (YEAR). */
export function periodLabel(dateIso: string, g: Granularity): string {
  const [y, m, d] = dateIso.slice(0, 10).split("-");
  if (g === "YEAR") return y;
  if (g === "MONTH") return `${m}/${y}`;
  return `${d}/${m}`;
}

/** Full label used in the tooltip. */
export function periodTitle(dateIso: string, g: Granularity): string {
  const [y, m, d] = dateIso.slice(0, 10).split("-");
  if (g === "YEAR") return y;
  if (g === "MONTH") return `Tháng ${m}/${y}`;
  if (g === "WEEK") return `Tuần từ ${d}/${m}/${y}`;
  return `${d}/${m}/${y}`;
}

/**
 * Fills missing periods with zero so a day with no sales is a visible empty bar,
 * not a line drawn straight across. `rows` use the API's bucket start dates.
 *
 *   const data = fillPeriods({ from: "2026-11-01", to: "2026-11-07", granularity: "DAY",
 *     rows: timeline.map((p) => ({ date: p.date, value: p.revenue, count: p.orders })) });
 */
export function fillPeriods({ from, to, granularity, rows, valueUnit = "đ", countUnit = "đơn" }: {
  from: string;
  to: string;
  granularity: Granularity;
  rows: { date: string; value: number; count?: number; compare?: number }[];
  valueUnit?: string;
  countUnit?: string;
}): BarDatum[] {
  const byDate = new Map(rows.map((r) => [r.date.slice(0, 10), r]));
  const out: BarDatum[] = [];
  const end = parseIso(to);
  let cur = bucketStart(parseIso(from), granularity);
  // Rows outside the requested range (API buckets) are still shown; never drop data.
  const extra = rows.filter((r) => r.date.slice(0, 10) < iso(cur) || r.date.slice(0, 10) > iso(end)).map((r) => r.date.slice(0, 10));
  for (let guard = 0; cur <= end && guard < 800; guard++) {
    const key = iso(cur);
    const r = byDate.get(key);
    out.push({
      key,
      label: periodLabel(key, granularity),
      value: r?.value ?? 0,
      count: r?.count ?? 0,
      compare: r?.compare,
      tooltip: `${periodTitle(key, granularity)} · ${formatNumber(r?.value ?? 0)} ${valueUnit}${r?.count !== undefined || !r ? ` · ${formatNumber(r?.count ?? 0)} ${countUnit}` : ""}`,
    });
    cur = nextBucket(cur, granularity);
  }
  for (const key of extra) {
    if (out.some((o) => o.key === key)) continue;
    const r = byDate.get(key)!;
    out.push({ key, label: periodLabel(key, granularity), value: r.value, count: r.count ?? 0, compare: r.compare, tooltip: `${periodTitle(key, granularity)} · ${formatNumber(r.value)} ${valueUnit} · ${formatNumber(r.count ?? 0)} ${countUnit}` });
  }
  return out.sort((a, b) => a.key.localeCompare(b.key));
}

function defaultTip(d: BarDatum, fmt: (v: number) => string, countUnit: string) {
  return d.tooltip ?? `${d.label} · ${fmt(d.value)}${d.count !== undefined ? ` · ${formatNumber(d.count)} ${countUnit}` : ""}`;
}

/**
 * Vertical bar chart, plain SVG.
 *
 *   <BarChart title="Doanh thu theo ngày" data={fillPeriods({...})} tone="green"
 *     formatValue={(v) => `${formatNumber(v)} đ`} height={240} />
 *
 * Hover/focus/tap shows a tooltip, arrow keys move across bars, a hidden table mirrors the data.
 * Works for 1 to 60 periods (labels thin out above ~10 per 640px).
 */
export function BarChart({
  data,
  title,
  tone = "green",
  height = 240,
  formatValue = (v) => `${formatNumber(v)} đ`,
  formatTick = compactVnd,
  countUnit = "đơn",
  valueHeader = "Giá trị",
}: {
  data: BarDatum[];
  title: string;
  tone?: Tone;
  height?: number;
  formatValue?: (v: number) => string;
  formatTick?: (v: number) => string;
  countUnit?: string;
  valueHeader?: string;
}) {
  const wrap = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(640);
  const [active, setActive] = useState<number | null>(null);
  const descId = useId();

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const measure = () => setWidth(Math.max(240, Math.round(el.clientWidth)));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Tapping elsewhere closes the touch tooltip.
  useEffect(() => {
    if (active === null) return;
    const onDown = (e: PointerEvent) => { if (!wrap.current?.contains(e.target as Node)) setActive(null); };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [active]);

  const n = data.length;
  const peak = Math.max(0, ...data.map((d) => Math.max(d.value, d.compare ?? 0)));
  const ticks = niceTicks(peak);
  const max = ticks[ticks.length - 1] || 1;
  const left = Math.max(...ticks.map((t) => formatTick(t).length)) * 6.6 + 14;
  const m = { left, right: 8, top: 10, bottom: 26 };
  const pw = Math.max(40, width - m.left - m.right);
  const ph = height - m.top - m.bottom;
  const band = pw / Math.max(n, 1);
  const bw = Math.max(2, Math.min(48, band * 0.62));
  const x0 = (i: number) => m.left + band * i + (band - bw) / 2;
  const cx = (i: number) => m.left + band * (i + 0.5);
  const y = (v: number) => m.top + ph * (1 - v / max);
  const every = Math.max(1, Math.ceil(n / Math.max(1, Math.floor(pw / 56))));
  const color = `var(--t-${tone})`;

  const tip = active !== null && data[active] ? defaultTip(data[active], formatValue, countUnit) : "";
  const tipW = tip.length * 6.4 + 24;
  const barTop = active !== null && data[active] ? y(Math.max(data[active].value, data[active].compare ?? 0)) : 0;
  // Above the bar when there is room; beside it for the tallest bars so the tooltip never covers the data.
  const side = active !== null && barTop < 40;
  const sideRight = active !== null && cx(active) + bw / 2 + 8 + tipW <= width - 4;
  const tipLeft = active === null ? 0
    : side ? (sideRight ? cx(active) + bw / 2 + 8 : Math.max(4, cx(active) - bw / 2 - 8 - tipW))
    : Math.min(Math.max(cx(active) - tipW / 2, 4), Math.max(4, width - tipW - 4));
  const tipTop = active === null ? 0 : side ? barTop + 34 : barTop - 8;

  const total = data.reduce((s, d) => s + d.value, 0);
  const summary = `${title}: ${n} kỳ, tổng ${formatValue(total)}${peak > 0 ? `, cao nhất ${formatValue(Math.max(...data.map((d) => d.value)))}` : ", chưa có phát sinh"}.`;

  const move = (delta: number | "start" | "end") => setActive((cur) => {
    if (!n) return null;
    if (delta === "start") return 0;
    if (delta === "end") return n - 1;
    return Math.min(n - 1, Math.max(0, (cur ?? (delta > 0 ? -1 : n)) + delta));
  });

  function path(i: number, h: number, w = bw, x = x0(i)) {
    const r = Math.min(4, w / 2, h);
    const top = y(0) - h;
    return `M${x},${y(0)}V${top + r}Q${x},${top} ${x + r},${top}H${x + w - r}Q${x + w},${top} ${x + w},${top + r}V${y(0)}Z`;
  }

  return (
    <figure className="bar-chart">
      <div
        ref={wrap}
        className="bar-chart-body"
        tabIndex={0}
        role="group"
        aria-label={`${title}. Dùng phím mũi tên trái, phải để xem từng kỳ.`}
        aria-describedby={descId}
        onKeyDown={(e) => {
          if (e.key === "ArrowRight") { e.preventDefault(); move(1); }
          else if (e.key === "ArrowLeft") { e.preventDefault(); move(-1); }
          else if (e.key === "Home") { e.preventDefault(); move("start"); }
          else if (e.key === "End") { e.preventDefault(); move("end"); }
          else if (e.key === "Escape") setActive(null);
        }}
        onBlur={() => setActive(null)}
        onPointerLeave={(e) => { if (e.pointerType !== "touch") setActive(null); }}
      >
        <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={summary}>
          <g aria-hidden="true">
            {ticks.map((t) => (
              <g key={t}>
                <line className="bc-grid" x1={m.left} x2={width - m.right} y1={y(t)} y2={y(t)} />
                <text className="bc-tick" x={m.left - 8} y={y(t) + 4} textAnchor="end">{formatTick(t)}</text>
              </g>
            ))}
            {data.map((d, i) => d.compare && d.compare > 0 ? (
              <path key={`c${d.key}`} className="bc-compare" d={path(i, Math.max(2, (d.compare / max) * ph), Math.min(56, bw * 1.3), cx(i) - Math.min(56, bw * 1.3) / 2)} />
            ) : null)}
            {data.map((d, i) => {
              const h = (d.value / max) * ph;
              const dim = active !== null && active !== i;
              return d.value > 0
                ? <path key={d.key} className="bc-bar" d={path(i, Math.max(2, h))} fill={color} opacity={dim ? 0.4 : 1} />
                : <rect key={d.key} className="bc-zero" x={x0(i)} y={y(0) - 2} width={bw} height={2} rx={1} opacity={dim ? 0.5 : 1} />;
            })}
            {data.map((d, i) => i % every === 0
              ? <text key={`l${d.key}`} className="bc-label" x={cx(i)} y={height - 8} textAnchor="middle">{d.label}</text> : null)}
            {data.map((d, i) => (
              <rect
                key={`h${d.key}`}
                className="bc-hit"
                x={m.left + band * i}
                y={m.top}
                width={band}
                height={ph + m.bottom}
                fill="transparent"
                onPointerEnter={() => setActive(i)}
                onPointerMove={(e) => { if (e.pointerType !== "touch") setActive(i); }}
                onPointerDown={() => setActive(i)}
              />
            ))}
          </g>
        </svg>
        {active !== null && tip ? (
          <div className="bc-tip" style={{ left: tipLeft, top: tipTop }} aria-hidden="true">{tip}</div>
        ) : null}
        <p className="bar-chart-live" id={descId} aria-live="polite">{active !== null ? tip : ""}</p>
      </div>
      <table className="bc-sr">
        <caption>{title}</caption>
        <thead><tr><th scope="col">Kỳ</th><th scope="col">{valueHeader}</th>{data.some((d) => d.count !== undefined) ? <th scope="col">Số lượng</th> : null}</tr></thead>
        <tbody>{data.map((d) => <tr key={d.key}><td>{d.tooltip?.split(" · ")[0] ?? d.label}</td><td>{formatValue(d.value)}</td>{d.count !== undefined ? <td>{formatNumber(d.count)}</td> : null}</tr>)}</tbody>
      </table>
    </figure>
  );
}

/**
 * Horizontal bars for ranked lists (best/slow products). Label on the left, value on the right.
 *
 *   <HBarChart title="Bán chạy" tone="blue" data={rows.map(r => ({ key: String(r.productId), label: r.productName, value: r.totalQuantitySold }))}
 *     formatValue={(v) => `${v} sp`} />
 */
export function HBarChart({
  data,
  title,
  tone = "blue",
  formatValue = (v) => formatNumber(v),
}: {
  data: BarDatum[];
  title: string;
  tone?: Tone;
  formatValue?: (v: number) => string;
}) {
  const [active, setActive] = useState<number | null>(null);
  const [at, setAt] = useState(0);
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <figure className="hbar-chart" onPointerLeave={(e) => { if (e.pointerType !== "touch") setActive(null); }}>
      <ol aria-label={title}>
        {data.map((d, i) => (
          <li
            key={d.key}
            tabIndex={0}
            className={active !== null && active !== i ? "dim" : ""}
            onPointerMove={(e) => { setActive(i); setAt(e.clientX - e.currentTarget.getBoundingClientRect().left); }}
            onFocus={() => { setActive(i); setAt(24); }}
            onBlur={() => setActive(null)}
          >
            <span className="hb-rank">{i + 1}</span>
            <span className="hb-label" title={d.label}>{d.label}</span>
            <span className="hb-track"><span className="hb-bar" style={{ width: `${Math.max(d.value > 0 ? 1.5 : 0, (d.value / max) * 100)}%`, background: `var(--t-${tone})` }} /></span>
            <span className="hb-value">{formatValue(d.value)}</span>
            {active === i ? <span className="bc-tip" style={{ left: Math.min(at, 260), top: -6 }} aria-hidden="true">{d.tooltip ?? `${d.label} · ${formatValue(d.value)}`}</span> : null}
          </li>
        ))}
      </ol>
    </figure>
  );
}
