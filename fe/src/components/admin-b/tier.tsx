"use client";

import { StatusBadge, type Tone } from "./status-badge";

/** Tier colour by name (presentation only). Unknown names fall back to violet. */
export function tierTone(name: string | null | undefined): Tone {
  const n = (name ?? "").toLowerCase();
  if (/đồng|dong|bronze|mới|moi|new/.test(n)) return "orange";
  if (/bạc|bac|silver/.test(n)) return "gray";
  if (/vàng|vang|gold/.test(n)) return "amber";
  if (/kim cương|kim cuong|diamond|platinum|bạch kim/.test(n)) return "cyan";
  return "violet";
}

export function TierBadge({ name }: { name: string | null | undefined }) {
  if (!name) return <span className="empty-value">Chưa có hạng</span>;
  return <StatusBadge status="TIER" tone={tierTone(name)} label={name} />;
}
