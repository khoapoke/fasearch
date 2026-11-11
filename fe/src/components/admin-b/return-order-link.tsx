"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { returnApi, refundStatus, returnMoney, type ReturnDetail } from "@/lib/return-client";
import { StatusBadge } from "./status-badge";
export function ReturnOrderLink({ orderId, orderCode, status }: { orderId: string; orderCode: string; status: string }) {
  const [summary, setSummary] = useState<{ paidAmount: number; refundedAmount: number } | null>(null);
  const [partial, setPartial] = useState(false);
  useEffect(() => {
    const c = new AbortController();
    returnApi<{ content: ReturnDetail[] }>(`/api/admin/returns?q=${encodeURIComponent(orderCode)}`, undefined, c.signal)
      .then(data => {
        const rows = data.content.filter(r => r.orderId === Number(orderId));
        setPartial(status === "COMPLETED" && rows.some(r => r.status === "REFUNDED"));
        const first = rows[0];
        if (first) { const next = { paidAmount: first.paidAmount, refundedAmount: first.orderRefundedAmount }; setSummary(next); }
      })
      .catch(() => { /* The list link remains available when this optional badge cannot load. */ });
    return () => c.abort();
  }, [orderCode, orderId, status]);
  return <section className="form-card"><h2>Đổi/trả {partial ? <StatusBadge status="RETURNED" tone="orange" label="Đã trả một phần" /> : null}</h2>{summary && summary.refundedAmount > 0 ? <p><strong>{refundStatus(summary.refundedAmount, summary.paidAmount)}</strong> · Đã hoàn {returnMoney(summary.refundedAmount)} / Đã trả {returnMoney(summary.paidAmount)}</p> : null}<Link className="text-link" href={`/quan-tri/doi-tra?q=${encodeURIComponent(orderCode)}`}>Xem yêu cầu đổi/trả của đơn →</Link></section>;
}
