"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AccountCenterShell } from "@/components/storefront/account-center-shell";
import { fetchOwnLoyalty, fetchOwnLoyaltyHistory, type OwnLoyalty } from "@/lib/benefits-client";
import { benefitErrorMessage, loyaltyActionLabel, loyaltySignedPoints, type LoyaltyHistoryEntry } from "@/lib/benefits";
import "@/components/storefront/preview.css";

type State =
  | { kind: "checking" }
  | { kind: "loading" }
  | { kind: "ready"; data: OwnLoyalty; history: LoyaltyHistoryEntry[] }
  | { kind: "error"; message: string; status: number };

export default function LoyaltyPage() {
  const router = useRouter();
  const [state, setState] = useState<State>({ kind: "checking" });
  const errorRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    setState({ kind: "loading" });
    try {
      const data = await fetchOwnLoyalty();
      let history: LoyaltyHistoryEntry[] = [];
      try {
        const pg = await fetchOwnLoyaltyHistory("page=0&size=20");
        history = pg.data;
      } catch (he) {
        const st = (he as { status?: number })?.status ?? 0;
        if (st !== 404) throw he;
      }
      setState({ kind: "ready", data, history });
    } catch (e) {
      const st = (e as { status?: number })?.status ?? 0;
      if (st === 401) {
        router.replace("/dang-nhap?next=/tai-khoan/diem-thuong");
        return;
      }
      setState({ kind: "error", message: benefitErrorMessage(st, null, e instanceof Error ? e.message : "Không tải được điểm thưởng."), status: st });
      setTimeout(() => errorRef.current?.focus(), 0);
    }
  }, [router]);

  useEffect(() => {
    void Promise.resolve().then(() => load());
  }, [load]);

  return (
    <AccountCenterShell active="/tai-khoan/diem-thuong" kicker="FASHION AI PROFILE HUB" title="Điểm Thưởng & Hạng Thành Viên">
      {state.kind === "checking" || state.kind === "loading" ? (
        <p className="pgState" role="status"><strong>Đang tải điểm thưởng…</strong></p>
      ) : null}
      {state.kind === "error" ? (
        <div ref={errorRef} tabIndex={-1} className="sfSideCard" role="alert">
          <p className="sfIdentitySub">{state.message}</p>
          <button className="hmCta hmCtaGhost" type="button" onClick={load}>Thử lại</button>
        </div>
      ) : null}
      {state.kind === "ready" ? (
        <>
          <section className="sfSideCard" aria-label="Số dư điểm">
            <div style={{ display: "flex", gap: 18, flexWrap: "wrap" }}>
              <div><b style={{ fontSize: 22 }}>{state.data.balance.khaDung.toLocaleString("vi-VN")}</b><p className="sfIdentitySub">điểm khả dụng</p></div>
              <div><b style={{ fontSize: 22 }}>{state.data.balance.soDu.toLocaleString("vi-VN")}</b><p className="sfIdentitySub">tổng số dư</p></div>
              <div><b style={{ fontSize: 22 }}>{state.data.balance.dangGiu.toLocaleString("vi-VN")}</b><p className="sfIdentitySub">đang giữ (đơn chưa xong)</p></div>
            </div>
            <p className="sfIdentitySub" style={{ marginTop: 8 }}>
              Hạng: <b>{state.data.balance.tierName ?? "Chưa xếp hạng"}</b> · Chi tiêu tích lũy: <b>{state.data.balance.tongChiTieu.toLocaleString("vi-VN")}₫</b>
              {state.data.balance.daMoDau === false ? " · Chưa ghi nhận số dư ban đầu." : ""}
            </p>
          </section>
          <section className="sfSideCard" aria-label="Lịch sử điểm" style={{ marginTop: 14 }}>
            <b>Lịch sử điểm (mới nhất trước)</b>
            {state.history.length === 0 ? (
              <p className="sfIdentitySub" style={{ marginTop: 6 }}>Chưa có biến động điểm nào cho tài khoản này.</p>
            ) : (
              state.history.map((h) => (
                <div className="pvRow" key={String(h.id)}>
                  <div style={{ flex: 1 }}>
                    <b className="name">{loyaltyActionLabel(h.loai)} {loyaltySignedPoints(h.loai, h.diem) > 0 ? `+${h.diem}` : `−${Math.abs(h.diem)}`} điểm</b>
                    <small>{h.thoiGian}{h.maDonHang ? ` · Đơn #${h.maDonHang}` : ""}</small>
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
