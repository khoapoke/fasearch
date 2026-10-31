"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AccountCenterShell } from "@/components/storefront/account-center-shell";
import { readOwnIdentity } from "@/components/account/account-session";
import "@/components/storefront/preview.css";
import "./voucher.css";

type State = "checking" | "ready" | "error";

export default function VouchersPage() {
  const router = useRouter();
  const [state, setState] = useState<State>("checking");
  const [code, setCode] = useState("");
  const [issue, setIssue] = useState("");
  const errorRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    setState("checking");
    try {
      const me = await readOwnIdentity().catch(() => null);
      if (!me) { router.replace("/dang-nhap?next=/voucher"); return; }
      setState("ready");
    } catch {
      setState("error");
      setTimeout(() => errorRef.current?.focus(), 0);
    }
  }, [router]);

  useEffect(() => { void Promise.resolve().then(() => load()); }, [load]);

  function continueToCheckout(event: React.FormEvent) {
    event.preventDefault();
    const normalized = code.trim().toUpperCase();
    if (!normalized || normalized.length > 50) { setIssue("Mã voucher phải có từ 1 đến 50 ký tự."); return; }
    setIssue("");
    router.push(`/thanh-toan?voucher=${encodeURIComponent(normalized)}`);
  }

  return (
    <AccountCenterShell active="/voucher" title="Voucher & ưu đãi">
      <section className="vcHero" aria-label="Ưu đãi dành cho bạn">
        <div>
          <h2>Voucher &amp; Ưu Đãi Cá Nhân</h2>
          <p>Nhập mã tại bước thanh toán để máy chủ kiểm tra hiệu lực, giỏ hàng và mức giảm thật.</p>
        </div>
      </section>
      {state === "checking" ? <p className="pgState" role="status"><strong>Đang kiểm tra tài khoản…</strong></p> : null}
      {state === "error" ? <div ref={errorRef} tabIndex={-1} className="sfSideCard" role="alert"><p className="sfIdentitySub">Không kiểm tra được tài khoản.</p><button className="hmCta hmCtaGhost" type="button" onClick={load}>Thử lại</button></div> : null}
      {state === "ready" ? <section className="sfSideCard" aria-label="Áp mã voucher tại thanh toán">
        <form className="pvCoupon" onSubmit={continueToCheckout}>
          <input value={code} onChange={(e) => setCode(e.target.value)} maxLength={50} placeholder="Nhập mã voucher…" aria-label="Mã voucher" autoComplete="off" />
          <button className="hmCta hmCtaPrimary" style={{ padding: "10px 18px", fontSize: 13 }} type="submit">Tiếp tục thanh toán</button>
        </form>
        {issue ? <p className="mpMuted" role="alert">{issue}</p> : null}
        <p className="mpMuted">Mã chỉ được kiểm tra khi có giỏ hàng ở bước thanh toán. S1 chưa cung cấp danh sách voucher công khai.</p>
      </section> : null}
      <p className="sfIdentitySub"><Link href="/sale">Săn thêm deal ở trang Sale →</Link></p>
    </AccountCenterShell>
  );
}
