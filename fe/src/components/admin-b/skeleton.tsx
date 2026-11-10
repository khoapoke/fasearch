"use client";

/** Placeholder blocks that match the loaded size so nothing jumps. */
export function Skeleton({ width = "100%", height = 14, radius = 4 }: { width?: number | string; height?: number | string; radius?: number }) {
  return <span className="skeleton" aria-hidden="true" style={{ width, height, borderRadius: radius }} />;
}

/**
 *   {loading ? <TableSkeleton rows={8} columns={6} rowHeight={44} /> : <table>...</table>}
 * Use rowHeight 52 for product rows.
 */
export function TableSkeleton({ rows = 8, columns = 5, rowHeight = 44, label = "Đang tải dữ liệu" }: { rows?: number; columns?: number; rowHeight?: number; label?: string }) {
  return (
    <div className="table-skeleton" role="status" aria-label={label}>
      {Array.from({ length: rows }, (_, r) => (
        <div className="table-skeleton-row" key={r} style={{ height: rowHeight, gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
          {Array.from({ length: columns }, (_, c) => <Skeleton key={c} width={c === 0 ? "70%" : `${45 + ((r * 7 + c * 13) % 40)}%`} />)}
        </div>
      ))}
    </div>
  );
}

export function CardSkeleton({ height = 120, label = "Đang tải dữ liệu" }: { height?: number; label?: string }) {
  return <div className="card-skeleton" role="status" aria-label={label} style={{ height }}><Skeleton width="40%" /><Skeleton width="65%" height={24} /></div>;
}
