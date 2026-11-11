"use client";

export type BadgeTone = "ok" | "low" | "out" | "info" | "neutral";

const TONES: Record<string, BadgeTone> = {
  ACTIVE: "ok",
  COMPLETED: "ok",
  PAID: "ok",
  ENABLED: "ok",
  RECONCILED: "ok",
  HOAT_DONG: "ok",
  READY: "ok",
  CONFIRMED: "info",
  PACKING: "info",
  SHIPPING: "info",
  PENDING: "info",
  PENDING_APPROVAL: "low",
  OUT_OF_STOCK: "low",
  TAM_DUNG: "low",
  DRAFT: "neutral",
  NHAP: "neutral",
  INACTIVE: "neutral",
  UNPUBLISHED: "neutral",
  DISABLED: "neutral",
  CANCELLED: "out",
  RETURNED: "out",
  LOCKED: "out",
  DISCONTINUED: "out",
  HET_HAN: "out",
  DELETED: "out",
};

export function statusTone(status: string | null | undefined): BadgeTone {
  return (status && TONES[status]) || "neutral";
}

export type Tone = "blue" | "violet" | "amber" | "cyan" | "green" | "red" | "orange" | "gray";

/** Single meaning map (order, payment). Statuses not listed keep the ok/low/out/info/neutral look. */
const TONE_MAP: Record<string, Tone> = {
  PENDING: "blue",
  CONFIRMED: "violet",
  PACKING: "amber",
  SHIPPING: "cyan",
  COMPLETED: "green",
  CANCELLED: "red",
  RETURNED: "orange",
  PAID: "green",
  UNPAID: "amber",
};

export function statusToneColor(status: string | null | undefined): Tone | null {
  return (status && TONE_MAP[status]) || null;
}

/**
 * `<StatusBadge status="PACKING" label="Đang đóng gói" />` takes the colour from the meaning map.
 * Pass `tone` to force one. The text label always stays, colour is never the only signal.
 */
export function StatusBadge({ status, label, tone }: { status: string | null | undefined; label?: string; tone?: Tone }) {
  const color = tone ?? statusToneColor(status);
  const className = color ? `t-${color}` : statusTone(status);
  return <span className={`badge ${className}`}>{label ?? status ?? "Chưa có"}</span>;
}

/**
 * Coloured number. `<Num tone="green" value={1450000} money />` renders `1.450.000 VND` with a small muted unit.
 * A zero is dimmed gray unless `dimZero={false}` (stock warnings). `signed` prefixes + or −.
 * tone="delta" picks green/red from the sign.
 */
export function Num({
  value,
  tone,
  money = false,
  bold = false,
  signed = false,
  dimZero = true,
  unit = "VND",
}: {
  value: number | null | undefined;
  tone?: Tone | "delta" | "ink";
  money?: boolean;
  bold?: boolean;
  signed?: boolean;
  dimZero?: boolean;
  unit?: string;
}) {
  if (value === null || value === undefined || !Number.isFinite(value)) return <span className="num-empty">—</span>;
  const zero = value === 0 && dimZero;
  const resolved = zero ? "gray" : tone === "delta" ? (value < 0 ? "red" : "green") : tone && tone !== "ink" ? tone : null;
  const text = Math.abs(value).toLocaleString("vi-VN", { maximumFractionDigits: 2 });
  const sign = signed && value !== 0 ? (value < 0 ? "−" : "+") : value < 0 ? "−" : "";
  const className = `num-val${resolved ? ` t-${resolved}` : ""}${bold ? " bold" : ""}${zero ? " dim" : ""}${money ? " money" : ""}`;
  return (
    <span className={className}>
      {sign}{text}
      {money ? <span className="unit">{unit}</span> : null}
    </span>
  );
}

/** Stock badge driven by the available count, not by an enum. */
export function StockBadge({ available, threshold }: { available: number | null; threshold: number | null }) {
  if (available === null || available === undefined) return <span className="badge neutral">Chưa có</span>;
  if (available <= 0) return <span className="badge out">Hết hàng</span>;
  if (threshold !== null && threshold !== undefined && available <= threshold) return <span className="badge low">Sắp hết</span>;
  return <span className="badge ok">Còn hàng</span>;
}
