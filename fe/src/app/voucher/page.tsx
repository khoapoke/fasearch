"use client";

import Link from "next/link";
import { useState } from "react";
import { AccountCenterShell } from "@/components/storefront/account-center-shell";
import { PREVIEW_VOUCHERS } from "@/lib/preview-data";
import "@/components/storefront/preview.css";
import "./voucher.css";

function copyCode(code: string, done: (c: string) => void) {
  const t = async () => {
    try {
      await navigator.clipboard.writeText(code);
      done(code);
    } catch {
      done("");
    }
  };
  void t();
}

export default function VouchersPage() {
  const [code, setCode] = useState("");
  const [applied, setApplied] = useState<string | null>(null);
  const [copied, setCopied] = useState("");
  const [msg, setMsg] = useState("");

  function apply(vcode: string) {
    setApplied(vcode);
    setMsg(`Đã lưu mã “${vcode}” cho lần đặt hàng preview tiếp theo. Mã minh họa — chưa trừ tiền thật.`);
  }

  return (
    <AccountCenterShell active="/voucher" kicker="FASHION AI PROFILE HUB" title="Voucher & Ưu Đãi Cá Nhân">
      <p className="sfPreviewBar" role="note" style={{ borderRadius: 12, marginBottom: 14 }}>
        <span>Bản xem trước — voucher minh họa, máy chủ chưa có API voucher (xem CONTRACT_GAPS).</span>
      </p>
      <section className="vcHero" aria-label="Ưu đãi dành cho bạn">
        <div>
          <p className="hmKicker">✦ ƯU ĐÃI DÀNH CHO BẠN</p>
          <h2>Voucher &amp; Ưu Đãi Cá Nhân</h2>
          <p>Bản xem trước — các mã là minh họa, chưa trừ tiền thật. Sao chép mã để dùng ở bản preview giỏ hàng.</p>
        </div>
      </section>
      <section className="sfSideCard" aria-label="Áp mã voucher">
        <form
          className="pvCoupon"
          onSubmit={(e) => {
            e.preventDefault();
            if (!code.trim()) {
              setMsg("Vui lòng nhập mã.");
              return;
            }
            apply(code.trim().toUpperCase());
          }}
        >
          <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Nhập mã voucher…" aria-label="Mã voucher" />
          <button className="hmCta hmCtaPrimary" style={{ padding: "10px 18px", fontSize: 13 }} type="submit">Áp dụng mã</button>
        </form>
        {msg ? <p className="mpMuted" role="status">{msg}</p> : null}
      </section>
      <div className="vcGrid">
        {PREVIEW_VOUCHERS.map((v) => (
          <div className="vcCard" key={v.code}>
            <p className="vcExp">{v.expiry}</p>
            <b>{v.title}</b>
            <small>{v.detail}</small>
            <p className="vcCodeRow">
              <span className="pvVoucherCode">{v.code}</span>
              <button className="hmCta hmCtaGhost" style={{ padding: "8px 14px", fontSize: 12.5 }} type="button" onClick={() => copyCode(v.code, setCopied)}>
                {copied === v.code ? "Đã chép ✓" : "Sao chép mã"}
              </button>
            </p>
            <button
              className={applied === v.code ? "hmCta hmCtaGhost" : "hmCta hmCtaPrimary"}
              style={{ padding: "9px 16px", fontSize: 13, width: "100%", justifyContent: "center" }}
              type="button"
              onClick={() => apply(v.code)}
            >
              {applied === v.code ? "Đã lưu ✓" : "Lưu mã"}
            </button>
          </div>
        ))}
      </div>
      <section className="sfSideCard" aria-label="Lịch sử voucher" style={{ marginTop: 14 }}>
        <b>Lịch sử voucher đã qua (minh họa)</b>
        <p className="sfIdentitySub" style={{ marginTop: 6 }}>FLASH80K · đã hết hạn 01/10/2026 — WELCOME50 · đã dùng cho đơn minh họa.</p>
      </section>
      <p className="sfIdentitySub"><Link href="/sale">Săn thêm deal ở trang Sale →</Link></p>
    </AccountCenterShell>
  );
}
