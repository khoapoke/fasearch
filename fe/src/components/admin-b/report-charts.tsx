"use client";

import { useEffect, useId, useRef, useState } from "react";
import { formatNumber } from "@/lib/admin-format";
import { compactVnd, niceTicks } from "./bar-chart";
import "./s1.css";

// ---------------------------------------------------------------- donut

export type DonutSlice = { key: string; label: string; value: number; detail?: string };

/**
 * Donut for a part-to-whole of at most 5 slices. Slice colours are the s1 categorical slots in order
 * (var(--s1-c1..5)); the legend repeats label, value and share, so colour is never the only cue.
 */
export function DonutChart({
  title,
  slices,
  formatValue,
  centerLabel,
  centerValue,
}: {
  title: string;
  slices: DonutSlice[];
  formatValue: (v: number) => string;
  centerLabel: string;
  centerValue: string;
}) {
  const [active, setActive] = useState<number | null>(null);
  const total = slices.reduce((s, x) => s + x.value, 0);
  const size = 124;
  const r = 46;
  const stroke = 18;
  const c = 2 * Math.PI * r;
  const gap = slices.filter((s) => s.value > 0).length > 1 ? 2.5 : 0;
  const arcs = slices.map((s, i) => {
    const before = slices.slice(0, i).reduce((sum, x) => sum + x.value, 0);
    const len = total > 0 ? (s.value / total) * c : 0;
    return { i, len: Math.max(0, len - gap), offset: total > 0 ? (before / total) * c : 0 };
  });
  const pct = (v: number) => (total > 0 ? `${((v / total) * 100).toLocaleString("vi-VN", { maximumFractionDigits: 1 })}%` : "0%");
  const tip = (s: DonutSlice) => `${s.label} · ${formatValue(s.value)} · ${pct(s.value)}${s.detail ? ` · ${s.detail}` : ""}`;
  const summary = `${title}: ${slices.map((s) => `${s.label} ${pct(s.value)}`).join(", ")}.`;

  return (
    <figure className="s1-donut" onPointerLeave={() => setActive(null)}>
      <div className="s1-donut-plot">
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={summary}>
          <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
            <circle className="s1-donut-track" cx={size / 2} cy={size / 2} r={r} strokeWidth={stroke} fill="none" />
            {arcs.map((a) => slices[a.i].value > 0 ? (
              <circle
                key={slices[a.i].key}
                cx={size / 2}
                cy={size / 2}
                r={r}
                fill="none"
                strokeWidth={active === a.i ? stroke + 4 : stroke}
                stroke={`var(--s1-c${a.i + 1})`}
                strokeDasharray={`${a.len} ${c - a.len}`}
                strokeDashoffset={-a.offset}
                opacity={active !== null && active !== a.i ? 0.45 : 1}
                className="s1-donut-arc"
                onPointerEnter={() => setActive(a.i)}
                onPointerDown={() => setActive(a.i)}
              />
            ) : null)}
          </g>
          <text className="s1-donut-center" x={size / 2} y={size / 2 + 1} textAnchor="middle">{centerValue}</text>
          <text className="s1-donut-sub" x={size / 2} y={size / 2 + 15} textAnchor="middle">{centerLabel}</text>
        </svg>
      </div>
      <ul className="s1-legend" aria-label={`${title}, chú giải`}>
        {slices.map((s, i) => (
          <li
            key={s.key}
            tabIndex={0}
            className={active === i ? "is-active" : active !== null ? "is-dim" : ""}
            onPointerEnter={() => setActive(i)}
            onFocus={() => setActive(i)}
            onBlur={() => setActive(null)}
            onKeyDown={(e) => { if (e.key === "Escape") setActive(null); }}
          >
            <span className="s1-swatch" style={{ background: `var(--s1-c${i + 1})` }} aria-hidden="true" />
            <span className="s1-legend-label">{s.label}</span>
            <span className="s1-legend-value">{formatValue(s.value)}</span>
            <span className="s1-legend-pct">{pct(s.value)}</span>
            {active === i ? <span className="s1-tip s1-tip-legend" aria-hidden="true">{tip(s)}</span> : null}
          </li>
        ))}
      </ul>
      <table className="s1-sr">
        <caption>{title}</caption>
        <thead><tr><th scope="col">Phương thức</th><th scope="col">Giá trị</th><th scope="col">Tỷ lệ</th></tr></thead>
        <tbody>{slices.map((s) => <tr key={s.key}><td>{s.label}</td><td>{formatValue(s.value)}</td><td>{pct(s.value)}</td></tr>)}</tbody>
      </table>
    </figure>
  );
}

// ---------------------------------------------------------------- orders + AOV per day

export type ComboPoint = { key: string; label: string; title: string; orders: number; revenue: number; aov: number | null };

/**
 * Bars = order count (left axis), line = average order value (right axis, đ). The two scales are
 * labelled at the top of each axis and keyed in the legend; days without orders are zero bars and
 * leave a gap in the line (an AOV of 0 would be false). One shared tooltip per day; arrow keys work.
 */
export function OrdersAovChart({ title, data, height = 230 }: { title: string; data: ComboPoint[]; height?: number }) {
  const wrap = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(640);
  const [active, setActive] = useState<number | null>(null);
  const liveId = useId();

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const measure = () => setWidth(Math.max(260, Math.round(el.clientWidth)));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (active === null) return;
    const onDown = (e: PointerEvent) => { if (!wrap.current?.contains(e.target as Node)) setActive(null); };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [active]);

  const n = data.length;
  const orderTicks = niceTicks(Math.max(0, ...data.map((d) => d.orders)), 4);
  const maxOrders = orderTicks[orderTicks.length - 1] || 1;
  const aovMax = Math.max(0, ...data.map((d) => d.aov ?? 0));
  const aovTicks = niceTicks(aovMax, orderTicks.length - 1 || 4);
  const maxAov = aovTicks[aovTicks.length - 1] || 1;
  const leftW = Math.max(...orderTicks.map((t) => String(t).length)) * 7 + 12;
  const rightW = Math.max(...aovTicks.map((t) => compactVnd(t).length)) * 6.6 + 12;
  const m = { left: leftW, right: rightW, top: 22, bottom: 24 };
  const pw = Math.max(80, width - m.left - m.right);
  const ph = height - m.top - m.bottom;
  const band = pw / Math.max(n, 1);
  const bw = Math.max(3, Math.min(34, band * 0.6));
  const cx = (i: number) => m.left + band * (i + 0.5);
  const yL = (v: number) => m.top + ph * (1 - v / maxOrders);
  const yR = (v: number) => m.top + ph * (1 - v / maxAov);
  const every = Math.max(1, Math.ceil(n / Math.max(1, Math.floor(pw / 52))));

  // Line segments break at days without orders.
  const segments: string[] = [];
  let cur = "";
  data.forEach((d, i) => {
    if (d.aov === null) { if (cur) segments.push(cur); cur = ""; return; }
    cur += `${cur ? "L" : "M"}${cx(i).toFixed(1)},${yR(d.aov).toFixed(1)}`;
  });
  if (cur) segments.push(cur);

  const tipOf = (d: ComboPoint) => d;
  const a = active !== null ? data[active] : null;
  const tipW = 200;
  // Beside the hovered column (right when it fits, else left) so the bar and line stay visible.
  const tipLeft = active === null ? 0
    : cx(active) + band / 2 + 8 + tipW <= width - 4 ? cx(active) + band / 2 + 8
    : Math.max(4, cx(active) - band / 2 - 8 - tipW);
  const totalOrders = data.reduce((s, d) => s + d.orders, 0);
  const summary = `${title}: ${n} ngày, tổng ${formatNumber(totalOrders)} đơn.`;

  const move = (delta: number | "start" | "end") => setActive((c) => {
    if (!n) return null;
    if (delta === "start") return 0;
    if (delta === "end") return n - 1;
    return Math.min(n - 1, Math.max(0, (c ?? (delta > 0 ? -1 : n)) + delta));
  });

  return (
    <figure className="s1-combo">
      <div className="s1-combo-key" aria-hidden="true">
        <span><i className="s1-swatch" style={{ background: "var(--s1-c1)" }} />Số đơn (trục trái)</span>
        <span><i className="s1-line-key" style={{ background: "var(--s1-c2)" }} />Giá trị đơn trung bình (trục phải)</span>
      </div>
      <div
        ref={wrap}
        className="s1-combo-body"
        tabIndex={0}
        role="group"
        aria-label={`${title}. Dùng phím mũi tên trái, phải để xem từng ngày.`}
        aria-describedby={liveId}
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
            <text className="s1-axis-title" x={2} y={10} textAnchor="start">Đơn</text>
            <text className="s1-axis-title" x={width - 2} y={10} textAnchor="end">đ / đơn</text>
            {orderTicks.map((t, i) => (
              <g key={t}>
                <line className="s1-gridline" x1={m.left} x2={width - m.right} y1={yL(t)} y2={yL(t)} />
                <text className="s1-tick" x={m.left - 8} y={yL(t) + 4} textAnchor="end">{formatNumber(t)}</text>
                {aovTicks[i] !== undefined ? <text className="s1-tick" x={width - m.right + 8} y={yR(aovTicks[i]) + 4} textAnchor="start">{compactVnd(aovTicks[i])}</text> : null}
              </g>
            ))}
            {active !== null ? <rect className="s1-band" x={m.left + band * active} y={m.top} width={band} height={ph} /> : null}
            {data.map((d, i) => d.orders > 0
              ? <rect key={d.key} className="s1-bar" x={cx(i) - bw / 2} y={yL(d.orders)} width={bw} height={yL(0) - yL(d.orders)} rx={Math.min(3, bw / 2)} fill="var(--s1-c1)" />
              : <rect key={d.key} className="s1-zero" x={cx(i) - bw / 2} y={yL(0) - 2} width={bw} height={2} rx={1} />)}
            {segments.map((d, i) => <path key={i} className="s1-aov-line" d={d} stroke="var(--s1-c2)" />)}
            {data.map((d, i) => d.aov !== null ? (
              <circle key={`p${d.key}`} className="s1-aov-dot" cx={cx(i)} cy={yR(d.aov)} r={active === i ? 4.5 : 3} fill="var(--s1-c2)" />
            ) : null)}
            {data.map((d, i) => i % every === 0 ? <text key={`l${d.key}`} className="s1-tick" x={cx(i)} y={height - 7} textAnchor="middle">{d.label}</text> : null)}
            {data.map((d, i) => (
              <rect
                key={`h${d.key}`}
                className="s1-hit"
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
        {a ? (
          <div className="s1-tip s1-tip-box" style={{ left: tipLeft, top: 18, width: tipW }} aria-hidden="true">
            <strong>{tipOf(a).title}</strong>
            <span><i className="s1-swatch" style={{ background: "var(--s1-c1)" }} />{formatNumber(a.orders)} đơn</span>
            <span><i className="s1-line-key" style={{ background: "var(--s1-c2)" }} />{a.aov === null ? "Chưa có đơn" : `${formatNumber(a.aov)} đ / đơn`}</span>
            <span className="s1-tip-muted">Doanh thu {formatNumber(a.revenue)} đ</span>
          </div>
        ) : null}
        <p className="s1-sr" id={liveId} aria-live="polite">{a ? `${a.title}: ${a.orders} đơn, ${a.aov === null ? "chưa có đơn" : `${formatNumber(a.aov)} đồng mỗi đơn`}` : ""}</p>
      </div>
      <table className="s1-sr">
        <caption>{title}</caption>
        <thead><tr><th scope="col">Ngày</th><th scope="col">Số đơn</th><th scope="col">Giá trị đơn trung bình</th><th scope="col">Doanh thu</th></tr></thead>
        <tbody>{data.map((d) => <tr key={d.key}><td>{d.title}</td><td>{formatNumber(d.orders)}</td><td>{d.aov === null ? "Chưa có đơn" : `${formatNumber(d.aov)} đ`}</td><td>{formatNumber(d.revenue)} đ</td></tr>)}</tbody>
      </table>
    </figure>
  );
}
