"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AccountCenterShell } from "@/components/storefront/account-center-shell";
import { readOwnIdentity } from "@/components/account/account-session";
import { fetchPublishedOffers } from "@/lib/benefits-client";
import {
  benefitErrorMessage, canonicalVoucherCode, discountKindLabel, type VoucherOffer,
} from "@/lib/benefits";
import "@/components/storefront/preview.css";
import "./voucher.css";

type State =
  | { kind: "checking" }
  | { kind: "loading" }
  | { kind: "ready"; offers: VoucherOffer[] }
  | { kind: "error"; message: string; status: number };

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("vi-VN");
}

export default function VouchersPage() {
  const router = useRouter();
  const [state, setState] = useState<State>({ kind: "checking" });
  const [code, setCode] = useState("");
  const [msg, setMsg] = useState("");
  const [issue, setIssue] = useState("");
  const errorRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    setState({ kind: "loading" });
    setMsg("");
    try {
      const me = await readOwnIdentity().catch(() => null);
      if (!me) {
        router.replace("/dang-nhap?next=/voucher");
        return;
      }
      const offers = await fetchPublishedOffers();
      setState({ kind: "ready", offers });
    } catch (e) {
      const st = (e as { status?: number })?.status ?? 0;
      setState({ kind: "error", message: benefitErrorMessage(st, null, e instanceof Error ? e.message : "Không tải được ưu đãi."), status: st });
      setTimeout(() => errorRef.current?.focus(), 0);
    }
  }, [router]);

  useEffect(() => {
    void Promise.resolve().then(() => load());
  }, [load]);

  function apply(vcode: string) {
    try {
      const c = canonicalVoucherCode(vcode);
      setIssue("");
      setMsg(`Đã lưu mã “${c}” — nhập mã này ở bước thanh toán, máy chủ quyết định mức giảm thật.`);
    } catch (e) {
      setIssue(e instanceof Error ? e.message : "Mã chưa hợp lệ.");
      setMsg("");
    }
  }

  return (
    <AccountCenterShell active="/voucher" kicker="FASHION AI PROFILE HUB" title="Voucher & Ưu Đãi Cá Nhân">
      <section className="vcHero" aria-label="Ưu đãi dành cho bạn">
        <div>
          <p className="hmKicker">✦ ƯU ĐÃI DÀNH CHO BẠN</p>
          <h2>Voucher &amp; Ưu Đãi Cá Nhân</h2>
          <p>Ưu đãi thật do cửa hàng phát hành. Sao chép mã rồi áp dụng ở bước thanh toán — mức giảm cuối cùng do máy chủ tính.</p>
        </div>
      </section>
      {state.kind === "checking" || state.kind === "loading" ? (
        <p className="pgState" role="status"><strong>Đang tải ưu đãi…</strong></p>
      ) : null}
      {state.kind === "error" ? (
        <div ref={errorRef} tabIndex={-1} className="sfSideCard" role="alert">
          <p className="sfIdentitySub">{state.message} {state.status === 401 ? <Link href="/dang-nhap?next=/voucher">Đăng nhập →</Link> : null}</p>
          <button className="hmCta hmCtaGhost" type="button" onClick={load}>Thử lại</button>
        </div>
      ) : null}
      {state.kind === "ready" ? (
        <>
          <section className="sfSideCard" aria-label="Áp mã voucher">
            <form
              className="pvCoupon"
              onSubmit={(e) => {
                e.preventDefault();
                apply(code);
              }}
            >
              <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Nhập mã voucher…" aria-label="Mã voucher" />
              <button className="hmCta hmCtaPrimary" style={{ padding: "10px 18px", fontSize: 13 }} type="submit">Lưu mã</button>
            </form>
            {issue ? <p className="mpMuted" role="alert">{issue}</p> : null}
            {msg ? <p className="mpMuted" role="status">{msg}</p> : null}
          </section>
          {state.offers.length === 0 ? (
            <p className="pgState"><strong>Chưa có ưu đãi nào đang chạy</strong>Quay lại sau — danh sách do cửa hàng phát hành.</p>
          ) : (
            <div className="vcGrid">
              {state.offers.map((v, i) => (
                <div className="vcCard" key={v.maKm ?? i}>
                  <p className="vcExp">Hiệu lực đến {fmtDate(v.ngayKetThuc)}</p>
                  <b>{v.tenCtkm}</b>
                  <small>{v.loaiGiam === "PHAN_TRAM" ? `Giảm ${v.giaTriGiam}%` : `Giảm ${Number(v.giaTriGiam).toLocaleString("vi-VN")}₫`} {discountKindLabel(v.loaiGiam)}</small>
                  {typeof v.conLai === "number" ? <small>Còn {v.conLai} lượt.</small> : null}
                </div>
              ))}
            </div>
          )}
        </>
      ) : null}
      <p className="sfIdentitySub"><Link href="/sale">Săn thêm deal ở trang Sale →</Link></p>
    </AccountCenterShell>
  );
}
