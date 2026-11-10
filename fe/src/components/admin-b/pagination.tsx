"use client";

import { formatNumber } from "@/lib/admin-format";

/**
 * One pagination pattern for every admin list: bordered controls with a visible
 * disabled state, and the real position plus the real total.
 */
export function Pager({
  page,
  totalPages,
  total,
  unit,
  onPage,
  busy = false,
}: {
  page: number;
  totalPages: number;
  total: number;
  unit: string;
  onPage: (next: number) => void;
  busy?: boolean;
}) {
  const pages = Math.max(1, totalPages);
  const current = Math.min(Math.max(0, page), pages - 1);
  return (
    <nav className="pager" aria-label="Phân trang">
      <button className="pager-btn pager-arrow" type="button" aria-label="Trang trước" disabled={busy || current === 0} onClick={() => onPage(current - 1)}>
        <span aria-hidden="true">‹</span>
      </button>
      <span className="pager-pos" aria-live="polite"><span className="sr-only">Trang </span>{current + 1} / {formatNumber(pages)}</span>
      <button className="pager-btn pager-arrow" type="button" aria-label="Trang sau" disabled={busy || current + 1 >= pages} onClick={() => onPage(current + 1)}>
        <span aria-hidden="true">›</span>
      </button>
      <span className="pager-total">{formatNumber(total)} {unit}</span>
    </nav>
  );
}
