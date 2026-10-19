"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { MerchantShell } from "@/components/merchant/merchant-shell";
import { fetchPublishedOffers } from "@/lib/benefits-client";
import { benefitErrorMessage, discountKindLabel, type VoucherOffer } from "@/lib/benefits";

type State =
  | { kind: "loading" }
  | { kind: "ready"; offers: VoucherOffer[] }
  | { kind: "error"; message: string; status: number };

export default function MerchantVouchers() {
  const [find, setFind] = useState("");
  const [state, setState] = useState<State>({ kind: "loading" });
  const errorRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    setState({ kind: "loading" });
    try {
      setState({ kind: "ready", offers: await fetchPublishedOffers() });
    } catch (e) {
      const st = (e as { status?: number })?.status ?? 0;
      setState({ kind: "error", message: benefitErrorMessage(st, null, e instanceof Error ? e.message : "Không tải được ưu đãi."), status: st });
      setTimeout(() => errorRef.current?.focus(), 0);
    }
  }, []);

  useEffect(() => {
    void Promise.resolve().then(() => load());
  }, [load]);

  const rows = state.kind === "ready"
    ? state.offers.filter((o) => !find.trim() || o.tenCtkm.toLowerCase().includes(find.trim().toLowerCase()))
    : [];

  return (
    <MerchantShell
      active="vouchers"
      previewNote="Ưu đãi đang phát hành (xem). Tạo/sửa/tạm dừng thuộc quản trị viên."
    >
      <div className="mpCard">
        <h2>Ưu Đãi Đang Phát Hành</h2>
        <p className="mpMuted">Nhân viên chỉ xem. Tạo/sửa/tạm dừng ở <Link href="/quan-tri/khuyen-mai">Quản trị khuyến mãi →</Link></p>
        <form className="mpSearch" style={{ maxWidth: 340, marginBottom: 10, marginTop: 10 }} role="search" onSubmit={(e) => e.preventDefault()}>
          <input value={find} onChange={(e) => setFind(e.target.value)} placeholder="Tìm theo tên…" aria-label="Tìm ưu đãi" />
        </form>
      </div>
      <div className="mpCard">
        {state.kind === "loading" ? <p className="mpMuted" role="status">Đang tải ưu đãi…</p> : null}
        {state.kind === "error" ? (
          <div ref={errorRef} tabIndex={-1} role="alert">
            <p className="mpMuted">{state.message}</p>
            <button className="mpTopBtn" type="button" onClick={load}>Thử lại</button>
          </div>
        ) : null}
        {state.kind === "ready" && rows.length === 0 ? (
          <p className="mpMuted" role="status">Chưa có ưu đãi nào đang phát hành.</p>
        ) : null}
        {state.kind === "ready" && rows.length > 0 ? (
          <div className="mpTableWrap">
            <table className="mpTable">
              <thead>
                <tr><th>Chương trình</th><th>Mức giảm</th><th>Hiệu lực đến</th><th>Còn lại</th></tr>
              </thead>
              <tbody>
                {rows.map((o, i) => (
                  <tr key={o.maKm ?? i}>
                    <td><b>{o.tenCtkm}</b><p className="mpMuted">#{o.maKm}</p></td>
                    <td>{o.loaiGiam === "PHAN_TRAM" ? `${o.giaTriGiam}%` : `${Number(o.giaTriGiam).toLocaleString("vi-VN")}₫`} {discountKindLabel(o.loaiGiam)}</td>
                    <td>{o.ngayKetThuc ? new Date(o.ngayKetThuc).toLocaleDateString("vi-VN") : "—"}</td>
                    <td>{typeof o.conLai === "number" ? o.conLai : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>
    </MerchantShell>
  );
}
