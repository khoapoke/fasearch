"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { formatDateTime } from "@/lib/admin-format";
import { getPointHistory, ledgerTypeLabel, reasonLabel, type LedgerPage } from "@/lib/admin-loyalty-client";
import "./s3.css";
import { Pager } from "./pagination";
import { TableSkeleton } from "./skeleton";
import { InfoHint } from "./info-hint";
import { Num, StatusBadge, type Tone } from "./status-badge";

const TYPE_TONE: Record<string, Tone> = { EARN: "green", REDEEM: "orange", ADJUST: "violet", OPENING: "gray", HOLD: "gray", RELEASE: "gray" };
const PAGE_SIZE = 10;

/** Compact points history for the customer detail page: date, type, signed delta, balance after, order, reason. */
export function PointsHistory({ customerId, refreshKey }: { customerId: string | number; refreshKey: number }) {
  const [page, setPage] = useState(0);
  const key = `${customerId}:${page}:${refreshKey}`;
  const [loaded, setLoaded] = useState<{ key: string; data: LedgerPage | null; error: string } | null>(null);
  const data = loaded?.data ?? null;
  const error = loaded?.error ?? "";
  const loading = loaded?.key !== key;

  useEffect(() => {
    const ctrl = new AbortController();
    getPointHistory(customerId, page, PAGE_SIZE, ctrl.signal)
      .then((d) => setLoaded({ key, data: d, error: "" }))
      .catch((e) => { if (!ctrl.signal.aborted) setLoaded({ key, data: null, error: e instanceof Error ? e.message : "Không tải được lịch sử điểm." }); });
    return () => ctrl.abort();
  }, [customerId, page, key]);

  if (error) return <div className="order-empty" role="alert"><strong>Không tải được lịch sử điểm</strong><p>{error}</p></div>;
  if (!data) return <TableSkeleton rows={4} columns={6} rowHeight={44} />;
  if (data.content.length === 0) return <p className="meta">Khách hàng chưa có biến động điểm nào.</p>;
  return <>
    <div className="table-scroll sticky-head table-cards pts-scroll" tabIndex={0} aria-label="Lịch sử điểm" aria-busy={loading}>
      <table className="review-orders-table pts-table">
        <caption className="sr-only">Lịch sử điểm của khách hàng</caption>
        <thead><tr><th>Thời gian</th><th>Loại</th><th className="num">Điểm</th><th className="num">Số dư sau{data.content.some((e) => e.balanceAfter === null) ? <> <InfoHint align="end">Khách này có điểm cũ chưa ghi trong sổ, nên không tính được số dư sau từng dòng.</InfoHint></> : null}</th><th>Đơn hàng</th><th>Lý do và ghi chú</th></tr></thead>
        <tbody>{data.content.map((e) => {
          const reason = reasonLabel(e.reasonCode);
          const neutral = e.type === "HOLD" || e.type === "RELEASE" || e.type === "OPENING";
          return <tr key={e.entryId}>
            <td data-label="Thời gian" className="tabnum">{formatDateTime(e.occurredAt)}</td>
            <td data-label="Loại"><StatusBadge status={`LEDGER_${e.type}`} tone={TYPE_TONE[e.type]} label={ledgerTypeLabel(e.type)} /></td>
            <td data-label="Điểm" className="num">{neutral ? <Num value={e.points} tone="gray" dimZero={false} /> : <Num value={e.delta} tone="delta" signed />}</td>
            <td data-label="Số dư sau" className="num">{e.balanceAfter === null ? "—" : <Num value={e.balanceAfter} tone="amber" />}</td>
            <td data-label="Đơn hàng">{e.orderId ? <Link className="pl-name" href={`/quan-tri/don-hang/${e.orderId}`}>{e.orderCode || `#${e.orderId}`}</Link> : "—"}</td>
            <td data-label="Lý do và ghi chú" className="pts-note-cell">
              {reason || e.note ? <div className="pts-note">
                {reason ? <span>{reason}</span> : null}
                {e.note ? <span className="meta pts-note-text" title={e.note}>{e.note}</span> : null}
                {e.actor ? <span className="meta">bởi {e.actor}</span> : null}
              </div> : "—"}
            </td>
          </tr>;
        })}</tbody>
      </table>
    </div>
    {data.totalPages > 1 ? <Pager page={page} totalPages={data.totalPages} total={data.totalElements} unit="dòng" busy={loading} onPage={setPage} /> : null}
  </>;
}
