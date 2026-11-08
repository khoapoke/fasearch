"use client";

import { InfoHint } from "./info-hint";
import { useCallback, useEffect, useState } from "react";
import { formatMoney, formatNumber } from "@/lib/admin-format";
import { applyEarnRecalc, previewEarnRecalc, type EarnRecalc } from "@/lib/admin-loyalty-client";
import "./s3.css";
import { AdminModal } from "./modal";
import { useToast } from "./toast";

/** Refusals worth explaining where the button would be; other reasons simply hide it. */
const BLOCKED_TEXT: Record<string, string> = {
  LEGACY_UNTRACKED: "Đơn cũ không xác minh được điểm đã cộng. Dùng Điều chỉnh điểm có lý do nếu khách thiếu điểm.",
  NO_POLICY_AT_CHECKOUT: "Lúc đặt đơn chưa bật chính sách điểm.",
  VOUCHER_NO_EARN: "Đơn dùng Voucher theo quy tắc cũ không tích điểm.",
};

/**
 * "Tính lại điểm": shown only while the order qualifies for earning and has no EARN entry yet.
 * The preview comes from the server with the same rules the normal path uses; confirming writes through
 * that path under the same key, so a second click only reports that the points already exist.
 */
export function PointsRecalcButton({ orderId, onDone }: { orderId: string | number; onDone?: () => void }) {
  const toast = useToast();
  const [preview, setPreview] = useState<EarnRecalc | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback((signal?: AbortSignal) => {
    previewEarnRecalc(orderId, signal).then(setPreview).catch(() => { if (!signal?.aborted) setPreview(null); });
  }, [orderId]);
  useEffect(() => { const ctrl = new AbortController(); load(ctrl.signal); return () => ctrl.abort(); }, [load]);

  async function confirm() {
    if (busy) return;
    setBusy(true); setError("");
    try {
      const result = await applyEarnRecalc(orderId);
      if (result.applied) toast.success(`Đã cộng ${formatNumber(result.points)} điểm cho khách. Số dư mới ${formatNumber(result.balanceAfter)}.`);
      else toast.success("Đơn này đã có điểm, không cộng thêm.");
      setOpen(false); setPreview(null); load(); onDone?.();
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : "Không tính lại được điểm. Thử lại.");
    } finally { setBusy(false); }
  }

  const blocked = preview && !preview.eligible && preview.reason ? BLOCKED_TEXT[preview.reason] : undefined;
  if (blocked) return <span className="meta pts-recalc-blocked">Không tính lại điểm được <InfoHint align="end">{blocked}</InfoHint></span>;
  if (!preview?.eligible) return null;
  const rate = preview.earnCurrencyPerPoint;
  return <>
    <button className="secondary" type="button" onClick={() => { setError(""); setOpen(true); }}>Tính lại điểm</button>
    <AdminModal open={open} title="Tính lại điểm cho đơn" description={preview.orderCode ?? undefined} size="sm" busy={busy} onClose={() => { if (!busy) setOpen(false); }}
      footer={<><button className="secondary" type="button" disabled={busy} onClick={() => setOpen(false)}>Hủy</button>
        <button className="primary" type="button" disabled={busy} onClick={() => void confirm()}>{busy ? "Đang cộng…" : `Cộng ${formatNumber(preview.points)} điểm`}</button></>}>
      <dl className="pts-balance pts-recalc">
        <div><dt>Tiền đã thanh toán</dt><dd>{formatMoney(preview.paidAmount)}</dd></div>
        <div><dt>Điểm sẽ cộng</dt><dd><strong className="t-green">+{formatNumber(preview.points)}</strong></dd></div>
        <div><dt>Số dư hiện tại</dt><dd><strong className="t-amber">{formatNumber(preview.balanceBefore)}</strong></dd></div>
        <div><dt>Sau khi cộng</dt><dd><strong className="t-amber">{formatNumber(preview.balanceAfter)}</strong></dd></div>
      </dl>
      <p className="meta pts-rule">
        {preview.policySource === "ORDER_SNAPSHOT"
          ? `Tính theo chính sách điểm lúc đặt đơn (phiên bản ${preview.policyVersion}): ${rate ? formatMoney(rate) : "—"} được 1 điểm.`
          : `Đơn tạo trước khi có chính sách điểm nên tính theo chính sách đang áp dụng (phiên bản ${preview.policyVersion}): ${rate ? formatMoney(rate) : "—"} được 1 điểm.`}
        {" "}Mỗi đơn chỉ được cộng một lần.
      </p>
      {error ? <p className="catalog-error" role="alert">{error}</p> : null}
    </AdminModal>
  </>;
}
