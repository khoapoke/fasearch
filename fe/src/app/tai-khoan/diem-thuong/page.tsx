"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { fetchOwnLoyalty, fetchOwnLoyaltyHistory, fetchOwnLoyaltyPolicy, type OwnLoyalty, type OwnPolicy } from "@/lib/benefits-client";
import { benefitErrorMessage, formatVnDateTime, loyaltyActionLabel, loyaltyHistoryAmount, loyaltyTierDisplayName, type LoyaltyHistoryEntry } from "@/lib/benefits";
import { getAccountIdentity } from "@/lib/account-identity-cache";
import "./loyalty.css";

type State =
  | { kind: "checking" }
  | { kind: "loading" }
  | { kind: "ready"; data: OwnLoyalty; history: LoyaltyHistoryEntry[]; policy: OwnPolicy | null; memberName: string }
  | { kind: "error"; message: string; status: number };

/** Lớp gradient theo tên hạng thật từ API (Đồng/Bạc/Vàng/Kim Cương…), hạng lạ về brand. */
function tierClass(name: string | null): string {
  const folded = (name ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase();
  if (folded.includes("kim")) return "lyTier-kimcuong";
  if (folded.includes("vang")) return "lyTier-vang";
  if (folded.includes("bac")) return "lyTier-bac";
  if (folded.includes("dong")) return "lyTier-dong";
  return "lyTier-other";
}

function ShirtMark() {
  return (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 40 40" fill="none">
      <path d="M27 3h10v10M13 37H3V27" stroke="currentColor" strokeWidth="2" />
      <path
        d="m14 10 6 3 6-3 8 6-4 6-4-2v12H14V20l-4 2-4-6 8-6Z"
        fill="#d6ef72"
        stroke="#20211f"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function LoyaltyPage() {
  const router = useRouter();
  const [state, setState] = useState<State>({ kind: "checking" });
  const errorRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    setState({ kind: "loading" });
    try {
      const [data, pg, policy, identity] = await Promise.all([
        fetchOwnLoyalty(),
        fetchOwnLoyaltyHistory("page=0&size=20"),
        // Chính sách là phép chiếu customer-safe; lỗi ở đây không chặn số dư/lịch sử.
        fetchOwnLoyaltyPolicy().catch(() => null),
        // Tên hiển thị dùng chung identity đã cache ở khung tài khoản (không fetch lại).
        getAccountIdentity().catch(() => null),
      ]);
      setState({ kind: "ready", data, history: pg.data, policy, memberName: identity?.username ?? "Thành viên FaSearch" });
    } catch (e) {
      const st = (e as { status?: number })?.status ?? 0;
      if (st === 401) {
        router.replace("/dang-nhap?next=/tai-khoan/diem-thuong");
        return;
      }
      setState({ kind: "error", message: benefitErrorMessage(st, (e as { code?: string })?.code ?? null, e instanceof Error ? e.message : "Không tải được điểm thưởng."), status: st });
    }
  }, [router]);

  useEffect(() => {
    void Promise.resolve().then(() => load());
  }, [load]);

  useEffect(() => {
    if (state.kind === "error") errorRef.current?.focus();
  }, [state]);

  if (state.kind === "checking" || state.kind === "loading") {
    return <p className="pgState" role="status"><strong>Đang tải điểm thưởng…</strong></p>;
  }

  if (state.kind === "error") {
    return (
      <div className="lyError" role="alert" tabIndex={-1} ref={errorRef}>
        <p>{state.message}</p>
        <button className="auth-button" type="button" onClick={load}>Thử lại</button>
      </div>
    );
  }

  const { balance } = state.data;
  const tierName = loyaltyTierDisplayName(balance);
  const enabled = state.policy?.policy.status === "ENABLED";
  // Hạng kế tiếp đọc từ danh sách hạng thật của API (không bịa tên/ngưỡng).
  const tiers = state.policy?.tiers ?? [];
  const cumulative = balance.cumulativePaidSales;
  const nextTier = cumulative === null
    ? null
    : tiers.filter((t) => t.minimumCumulativePaidSales > cumulative).sort((a, b) => a.minimumCumulativePaidSales - b.minimumCumulativePaidSales)[0] ?? null;
  const floor = cumulative === null
    ? 0
    : tiers.filter((t) => t.minimumCumulativePaidSales <= cumulative).reduce((m, t) => Math.max(m, t.minimumCumulativePaidSales), 0);
  const progressPct = nextTier && cumulative !== null && nextTier.minimumCumulativePaidSales > floor
    ? Math.min(100, Math.max(0, ((cumulative - floor) / (nextTier.minimumCumulativePaidSales - floor)) * 100))
    : 0;

  return (
    <>
      <section className={`lyCard ${tierClass(balance.salesTierName)}`} aria-label="Thẻ thành viên FaSearch">
        <div className="lyCard-top">
          <span className="lyCard-brand"><ShirtMark /> FaSearch</span>
          <span className="lyCard-tier">{tierName}</span>
        </div>
        <p className="lyCard-name">{state.memberName}</p>
        <p className="lyCard-sub">Thẻ thành viên</p>
        <p className="lyCard-points">
          {balance.availablePoints?.toLocaleString("vi-VN") ?? "—"} <small>điểm khả dụng</small>
        </p>
      </section>

      <div className="lyStats">
        <div className="lyStat">
          <b>{balance.availablePoints?.toLocaleString("vi-VN") ?? "—"}</b>
          <span>điểm khả dụng</span>
        </div>
        <div className="lyStat">
          <b>{balance.heldPoints.toLocaleString("vi-VN")}</b>
          <span>đang giữ (đơn chưa xong)</span>
        </div>
        <div className="lyStat">
          <b>{cumulative === null ? "—" : `${cumulative.toLocaleString("vi-VN")}₫`}</b>
          <span>chi tiêu tích lũy</span>
        </div>
      </div>

      {nextTier && cumulative !== null ? (
        <section className="lyProgress" aria-label="Tiến độ lên hạng tiếp theo">
          <p>Còn <strong>{(nextTier.minimumCumulativePaidSales - cumulative).toLocaleString("vi-VN")}₫</strong> nữa để lên hạng <strong>{nextTier.name}</strong></p>
          <div className="lyBar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progressPct)} aria-label={`Đã đạt ${Math.round(progressPct)}% tới hạng ${nextTier.name}`}>
            <i style={{ width: `${progressPct}%` }} />
          </div>
          <small>{cumulative.toLocaleString("vi-VN")}₫ / {nextTier.minimumCumulativePaidSales.toLocaleString("vi-VN")}₫</small>
        </section>
      ) : null}

      <section className="lyHowto" aria-label="Cách tích và dùng điểm">
        <h2>Cách tích và dùng điểm</h2>
        {state.policy && enabled ? (
          <>
            <p>Mỗi {state.policy.policy.earnCurrencyPerPoint.toLocaleString("vi-VN")}₫ chi tiêu được 1 điểm.</p>
            <p>{state.policy.policy.redeemCurrencyPerPoint.toLocaleString("vi-VN")} điểm giảm 1₫ khi thanh toán.</p>
          </>
        ) : (
          <p>Chính sách điểm hiện chưa bật cho tài khoản này.</p>
        )}
      </section>

      <section className="lyHist" aria-label="Lịch sử điểm">
        <h2>Lịch sử điểm</h2>
        {state.history.length === 0 ? (
          <p className="lyHist-empty">Chưa có biến động điểm nào cho tài khoản này.</p>
        ) : (
          state.history.map((h) => {
            const amount = loyaltyHistoryAmount(h.type, h.points);
            return (
              <div className="lyHist-row" key={String(h.entryId)}>
                <div>
                  <b className="name">{loyaltyActionLabel(h.type)}</b>
                  <small>{formatVnDateTime(h.occurredAt)}{h.orderId ? ` · Đơn #${h.orderId}` : ""}</small>
                </div>
                <span className={`lyHist-amt ${amount.direction}`}>{amount.text}</span>
              </div>
            );
          })
        )}
      </section>

      <p className="lyFoot">
        Điểm chỉ cộng từ đơn đã thanh toán thật. <Link href="/voucher">Xem voucher →</Link>
      </p>
    </>
  );
}
