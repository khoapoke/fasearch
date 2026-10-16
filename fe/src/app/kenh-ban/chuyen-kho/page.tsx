"use client";

import { useEffect, useState } from "react";
import { MerchantShell } from "@/components/merchant/merchant-shell";
import { WhAuthNote, WhErrorBox, toWhError } from "@/components/merchant/wh";
import { readOwnIdentity, type AccountIdentity } from "@/components/account/account-session";
import {
  newKhoaTam,
  unwrap,
  whWrite,
  whFetch,
  type KhoDiaDiem,
  type PhieuKho,
  type WhError,
} from "@/lib/wh-client";

export default function TransferPage() {
  const [me, setMe] = useState<AccountIdentity | null>(null);
  const [locs, setLocs] = useState<KhoDiaDiem[]>([]);
  const [nguon, setNguon] = useState("");
  const [dich, setDich] = useState("");
  const [lyDo, setLyDo] = useState("");
  const [ref, setRef] = useState("");
  const [qty, setQty] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<WhError | null>(null);
  const [done, setDone] = useState<PhieuKho | null>(null);

  useEffect(() => {
    let live = true;
    readOwnIdentity()
      .then((identity) => live && setMe(identity))
      .catch(() => {});
    whFetch("v1/kho/dia-diem")
      .then(async (r) => {
        if (!r.ok) {
          if (live) setError(await toWhError(r));
          return;
        }
        const list = await unwrap<KhoDiaDiem[]>(r);
        if (live) {
          setLocs(list);
          if (list.length >= 2) {
            setNguon(String(list[0].maKho));
            setDich(String(list[1].maKho));
          }
        }
      })
      .catch(() => {
        if (live) setError({ status: 0, code: "NETWORK", message: "Không kết nối được máy chủ kho.", errors: [] });
      });
    return () => {
      live = false;
    };
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (!ref.trim() || !(Number(qty) > 0)) {
      setError({ status: 0, code: "LOCAL", message: "Nhập SKU/mã vạch và số lượng > 0.", errors: [] });
      return;
    }
    if (nguon === dich) {
      setError({ status: 0, code: "LOCAL", message: "Kho nguồn và kho đích phải khác nhau.", errors: [] });
      return;
    }
    setBusy(true);
    setError(null);
    setDone(null);
    try {
      const item = /^\d+$/.test(ref.trim())
        ? { maSku: Number(ref.trim()), soLuong: Number(qty) }
        : { maVach: ref.trim(), soLuong: Number(qty) };
      // Nháp + chốt liền: tạo nháp rồi xác nhận ngay trong cùng luồng người dùng.
      const draft = await whWrite("v1/kho/phieu/chuyen", "POST", {
        maKhoNguon: Number(nguon),
        maKhoDich: Number(dich),
        items: [item],
        khoaTam: newKhoaTam(),
        lyDo: lyDo.trim() || undefined,
      });
      if (!draft.ok) {
        setError(await toWhError(draft));
        return;
      }
      const doc = await unwrap<PhieuKho>(draft);
      const conf = await whWrite(`v1/kho/phieu/${doc.maPhieu}/xac-nhan`, "POST");
      if (!conf.ok) {
        setError(await toWhError(conf));
        setDone(doc);
        return;
      }
      setDone(await unwrap<PhieuKho>(conf));
    } catch {
      setError({ status: 0, code: "NETWORK", message: "Không kết nối được máy chủ kho.", errors: [] });
    } finally {
      setBusy(false);
    }
  }

  return (
    <MerchantShell active="transfer">
      <div className="mpCard">
        <h2>Chuyển kho (nguyên tử nguồn → đích)</h2>
        <p className="mpMuted">
          STAFF/ADMIN. Nguồn và đích chốt cùng transaction — thiếu tồn khả dụng
          báo 409 <b>KHONG_DU_TON</b> và rollback cả hai, không hàng “đang bay”.
        </p>
        <WhAuthNote role={me?.role ?? null} />
      </div>
      <WhErrorBox error={error} />
      <div className="mpCard">
        <form onSubmit={submit} style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <label>Kho nguồn
            <select value={nguon} onChange={(e) => setNguon(e.target.value)} style={{ display: "block", width: "100%", border: "1px solid var(--line)", borderRadius: 10, padding: "10px 12px", marginTop: 4 }}>
              {locs.map((l) => <option key={l.maKho} value={l.maKho}>{l.tenKho}</option>)}
            </select>
          </label>
          <label>Kho đích
            <select value={dich} onChange={(e) => setDich(e.target.value)} style={{ display: "block", width: "100%", border: "1px solid var(--line)", borderRadius: 10, padding: "10px 12px", marginTop: 4 }}>
              {locs.map((l) => <option key={l.maKho} value={l.maKho}>{l.tenKho}</option>)}
            </select>
          </label>
          <label>SKU hoặc mã vạch
            <input value={ref} onChange={(e) => setRef(e.target.value)} placeholder="12 hoặc SP3-DO-M" style={{ display: "block", width: "100%", border: "1px solid var(--line)", borderRadius: 10, padding: "10px 12px", marginTop: 4 }} />
          </label>
          <label>Số lượng
            <input value={qty} onChange={(e) => setQty(e.target.value)} inputMode="numeric" placeholder="> 0" style={{ display: "block", width: "100%", border: "1px solid var(--line)", borderRadius: 10, padding: "10px 12px", marginTop: 4 }} />
          </label>
          <label style={{ gridColumn: "1/-1" }}>Lý do (tùy chọn)
            <input value={lyDo} onChange={(e) => setLyDo(e.target.value)} maxLength={1000} style={{ display: "block", width: "100%", border: "1px solid var(--line)", borderRadius: 10, padding: "10px 12px", marginTop: 4 }} />
          </label>
          <div style={{ gridColumn: "1/-1" }}>
            <button className="mpTopBtn primary" type="submit" disabled={busy}>{busy ? "Đang chuyển…" : "Tạo nháp & chốt chuyển"}</button>
          </div>
        </form>
      </div>
      {done ? (
        <div className="mpCard" role="status" aria-label="Kết quả chuyển kho">
          <h2>Phiếu #{done.maPhieu} · {done.trangThai === "DA_XAC_NHAN" ? "Đã chốt chuyển" : "Nháp (chốt lỗi — xem lỗi ở trên)"}</h2>
          <p className="mpMuted">Nguồn #{done.maKhoNguon} → Đích #{done.maKhoDich} · {done.items.length} dòng · Khóa {done.khoaTam}</p>
        </div>
      ) : null}
    </MerchantShell>
  );
}
