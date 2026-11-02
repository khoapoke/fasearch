"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AccountCenterShell } from "@/components/storefront/account-center-shell";
import { fetchOwnLoyalty, fetchOwnLoyaltyHistory, fetchOwnLoyaltyPolicy, type OwnLoyalty, type OwnPolicy } from "@/lib/benefits-client";
import { benefitErrorMessage, loyaltyActionLabel, loyaltySignedPoints, type LoyaltyHistoryEntry } from "@/lib/benefits";
import "@/components/storefront/preview.css";

type State =
  | { kind: "checking" }
  | { kind: "loading" }
  | { kind: "ready"; data: OwnLoyalty; history: LoyaltyHistoryEntry[]; policy: OwnPolicy | null }
  | { kind: "error"; message: string; status: number };

export default function LoyaltyPage() {
  const router = useRouter();
  const [state, setState] = useState<State>({ kind: "checking" });
  const errorRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    setState({ kind: "loading" });
    try {
      const data = await fetchOwnLoyalty();
      const pg = await fetchOwnLoyaltyHistory("page=0&size=20");
      // Chính sách là phép chiếu customer-safe; lỗi ở đây không chặn số dư/lịch sử.
      const policy = await fetchOwnLoyaltyPolicy().catch(() => null);
      setState({ kind: "ready", data, history: pg.data, policy });
    } catch (e) {
      const st = (e as { status?: number })?.status ?? 0;
      if (st === 401) {
        router.replace("/dang-nhap?next=/tai-khoan/diem-thuong");
        return;
      }
      setState({ kind: "error", message: benefitErrorMessage(st, (e as { code?: string })?.code ?? null, e instanceof Error ? e.message : "Không tải được điểm thưởng."), status: st });
      setTimeout(() => errorRef.current?.focus(), 0);
    }
  }, [router]);

  useEffect(() => {
    void Promise.resolve().then(() => load());
  }, [load]);

  return (
    <AccountCenterShell active="/tai-khoan/diem-thuong" title="Điểm thưởng & hạng">
      {state.kind === "checking" || state.kind === "loading" ? (
        <p className="pgState" role="status"><strong>Đang tải điểm thưởng…</strong></p>
      ) : null}
      {state.kind === "error" ? (
        <div ref={errorRef} tabIndex={-1} className="sfSideCard" role="alert">
          <p className="sfIdentitySub">{state.message}</p>
          <button className="auth-button" type="button" onClick={load}>Thử lại</button>
        </div>
      ) : null}
      {state.kind === "ready" ? (
        <>
          <section className="sfSideCard" aria-label="Số dư điểm">
            <div style={{ display: "flex", gap: 18, flexWrap: "wrap" }}>
              <div><b style={{ fontSize: 22 }}>{state.data.balance.availablePoints?.toLocaleString("vi-VN") ?? "—"}</b><p className="sfIdentitySub">điểm khả dụng</p></div>
              <div><b style={{ fontSize: 22 }}>{state.data.balance.balancePoints.toLocaleString("vi-VN")}</b><p className="sfIdentitySub">tổng số dư</p></div>
              <div><b style={{ fontSize: 22 }}>{state.data.balance.heldPoints.toLocaleString("vi-VN")}</b><p className="sfIdentitySub">đang giữ (đơn chưa xong)</p></div>
            </div>
            <p className="sfIdentitySub" style={{ marginTop: 8 }}>
              Hạng: <b>{state.data.balance.salesTierName ?? (state.data.balance.salesTierStatus === "HISTORY_UNKNOWN" ? "Chưa đủ dữ liệu" : "Chưa xếp hạng")}</b> · Chi tiêu tích lũy: <b>{state.data.balance.cumulativePaidSales === null ? "Chưa đủ dữ liệu" : `${state.data.balance.cumulativePaidSales.toLocaleString("vi-VN")}₫`}</b>
              {!state.data.balance.openingRecorded ? " · Số dư cũ chưa ghi nhận mở đầu; hiện chưa thể đổi điểm." : ""}
              {state.data.balance.policyStatus === "DISABLED" ? " · Chính sách điểm đang tắt; số dư vẫn được giữ." : ""}
              {state.data.balance.policyStatus === "UNCONFIGURED" ? " · Chưa cấu hình chính sách điểm." : ""}
            </p>
          </section>
          {state.policy ? (
            <section className="sfSideCard" aria-label="Cách tích và dùng điểm" style={{ marginTop: 14 }}>
              <b>Cách tích và dùng điểm</b>
              <p className="sfIdentitySub" style={{ marginTop: 6 }}>
                {state.policy.policy.status === "ENABLED"
                  ? `Mỗi ${state.policy.policy.earnCurrencyPerPoint.toLocaleString("vi-VN")}₫ chi tiêu được 1 điểm; ${state.policy.policy.redeemCurrencyPerPoint.toLocaleString("vi-VN")} điểm giảm 1₫ khi thanh toán.`
                  : "Chính sách điểm hiện chưa bật cho tài khoản này."}
              </p>
              {state.policy.tiers.length > 0 ? (
                <ul className="sfIdentitySub" style={{ margin: "8px 0 0", paddingLeft: 18 }}>
                  {state.policy.tiers.map((tier) => (
                    <li key={tier.tierId}>
                      <b>{tier.name}</b> · từ {tier.minimumCumulativePaidSales.toLocaleString("vi-VN")}₫ chi tiêu tích lũy
                      {state.data.balance.salesTierName === tier.name ? " · hạng hiện tại" : ""}
                    </li>
                  ))}
                </ul>
              ) : null}
              <p className="sfIdentitySub" style={{ marginTop: 8 }}>
                Chính sách phiên bản {state.policy.policy.version}. Điểm chỉ cộng từ đơn đã thanh toán thật.
              </p>
            </section>
          ) : null}
          <section className="sfSideCard" aria-label="Lịch sử điểm" style={{ marginTop: 14 }}>
            <b>Lịch sử điểm (mới nhất trước)</b>
            {state.history.length === 0 ? (
              <p className="sfIdentitySub" style={{ marginTop: 6 }}>Chưa có biến động điểm nào cho tài khoản này.</p>
            ) : (
              state.history.map((h) => (
                <div className="pvRow" key={String(h.entryId)}>
                  <div style={{ flex: 1 }}>
                    <b className="name">{loyaltyActionLabel(h.type)} {h.type === "OPENING" ? `${h.points} điểm (số dư nền)` : `${loyaltySignedPoints(h.type, h.points) > 0 ? "+" : "−"}${Math.abs(h.points)} điểm`}</b>
                    <small>{h.occurredAt}{h.orderId ? ` · Đơn #${h.orderId}` : ""}</small>
                  </div>
                </div>
              ))
            )}
          </section>
        </>
      ) : null}
      <p className="sfIdentitySub" style={{ marginTop: 12 }}>
        Điểm chỉ tích từ đơn đã thanh toán thật; hủy trước bàn giao nhả giữ; dùng điểm không làm giảm chi tiêu tích lũy. <Link href="/voucher">Xem voucher →</Link>
      </p>
    </AccountCenterShell>
  );
}
