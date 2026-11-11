"use client";

import { useEffect, useState } from "react";
import { MerchantShell } from "@/components/merchant/merchant-shell";
import { WhAuthNote, WhErrorBox, toWhError } from "@/components/merchant/wh";
import { readOwnIdentity, type AccountIdentity } from "@/components/account/account-session";
import {
  newKhoaTam,
  unwrap,
  whFetch,
  whWrite,
  type KhoDiaDiem,
  type PhieuKho,
  type WhError,
} from "@/lib/wh-client";

type CountRow = { maSku: number; soDem: string };

export default function CountPage() {
  const [me, setMe] = useState<AccountIdentity | null>(null);
  const [locs, setLocs] = useState<KhoDiaDiem[]>([]);
  const [kho, setKho] = useState("");
  const [skuText, setSkuText] = useState("");
  const [draft, setDraft] = useState<PhieuKho | null>(null);
  const [counts, setCounts] = useState<CountRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<WhError | null>(null);
  const [notice, setNotice] = useState("");

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
          const def = list.find((l) => l.laMacDinh) ?? list[0];
          if (def) setKho(String(def.maKho));
        }
      })
      .catch(() => {
        if (live) setError({ status: 0, code: "NETWORK", message: "Không kết nối được máy chủ kho.", errors: [] });
      });
    return () => {
      live = false;
    };
  }, []);

  function parseSkus(): number[] {
    const nums = skuText
      .split(/[\s,;]+/)
      .map((s) => s.trim())
      .filter((s) => /^\d+$/.test(s))
      .map(Number);
    return [...new Set(nums)];
  }

  async function createBaseline() {
    if (busy) return;
    const skus = parseSkus();
    if (!kho || skus.length === 0) {
      setError({ status: 0, code: "LOCAL", message: "Chọn kho và nhập ít nhất một maSku số.", errors: [] });
      return;
    }
    setBusy(true);
    setError(null);
    setNotice("");
    try {
      const r = await whWrite("v1/kho/phieu/kiem-ke", "POST", {
        maKho: Number(kho),
        khoaTam: newKhoaTam(),
        items: skus.map((maSku) => ({ maSku })),
      });
      if (!r.ok) {
        setError(await toWhError(r));
        return;
      }
      const doc = await unwrap<PhieuKho>(r);
      setDraft(doc);
      // Hiển thị baseline TRƯỚC khi đếm: số đếm để trống, bắt buộc nhập đủ mới được chốt.
      setCounts(doc.items.map((it) => ({ maSku: it.maSku, soDem: "" })));
      setNotice(`Đã lấy baseline lúc tạo phiếu #${doc.maPhieu}. Đếm vật lý rồi nhập số đếm (0 hợp lệ) — chưa ghi gì cả.`);
    } catch {
      setError({ status: 0, code: "NETWORK", message: "Không kết nối được máy chủ kho.", errors: [] });
    } finally {
      setBusy(false);
    }
  }

  async function saveCounts() {
    if (busy || !draft) return;
    const missing = counts.filter((c) => c.soDem.trim() === "");
    if (missing.length > 0) {
      setError({ status: 0, code: "LOCAL", message: `Còn ${missing.length} dòng chưa nhập số đếm — phải đếm đủ mới được chốt.`, errors: [] });
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const r = await whWrite(`v1/kho/phieu/${draft.maPhieu}/so-dem`, "PUT", {
        items: counts.map((c) => ({ maSku: c.maSku, soDem: Number(c.soDem) })),
      });
      if (!r.ok) {
        setError(await toWhError(r));
        return;
      }
      setDraft(await unwrap<PhieuKho>(r));
      setNotice("Đã ghi số đếm lên bản nháp. Kiểm tra lại rồi bấm xác nhận.");
    } catch {
      setError({ status: 0, code: "NETWORK", message: "Không kết nối được máy chủ kho.", errors: [] });
    } finally {
      setBusy(false);
    }
  }

  async function confirm() {
    if (busy || !draft) return;
    if (!window.confirm(`Chốt kiểm kê #${draft.maPhieu}? Nếu tồn đã đổi sau baseline, máy chủ trả 409 và không đổi gì.`)) return;
    setBusy(true);
    setError(null);
    try {
      const r = await whWrite(`v1/kho/phieu/${draft.maPhieu}/xac-nhan`, "POST");
      if (!r.ok) {
        const e = await toWhError(r);
        setError(e);
        if (r.status === 409) {
          setNotice("Tồn đã đổi sau baseline (409) — phiếu giữ nguyên nháp, số đếm cũ KHÔNG được áp. Tạo baseline mới và đếm lại.");
        }
        return;
      }
      const doc = await unwrap<PhieuKho>(r);
      setDraft(doc);
      setNotice(
        doc.maPhieuLienKet
          ? `Đã chốt. Sinh phiếu cân bằng liên kết #${doc.maPhieuLienKet} trong cùng transaction.`
          : "Đã chốt — mọi chênh lệch bằng 0, không sinh phiếu cân bằng.",
      );
    } catch {
      setError({ status: 0, code: "NETWORK", message: "Không kết nối được máy chủ kho.", errors: [] });
    } finally {
      setBusy(false);
    }
  }

  function freshBaseline() {
    setDraft(null);
    setCounts([]);
    setNotice("");
    setError(null);
  }

  return (
    <MerchantShell active="count">
      <div className="mpCard">
        <h2>Kiểm kê: baseline trước, đếm sau</h2>
        <p className="mpMuted">
          STAFF/ADMIN. Máy chủ lưu tồn/phiên bản từng dòng lúc tạo phiếu. Xác nhận đối chiếu
          trong một transaction — lệch là 409, rollback toàn bộ, phiếu ở lại nháp.
        </p>
        <WhAuthNote role={me?.role ?? null} />
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 10 }}>
          <label>Kho kiểm
            <select value={kho} onChange={(e) => setKho(e.target.value)} style={{ display: "block", border: "1px solid var(--line)", borderRadius: 10, padding: "9px 12px", marginTop: 4 }}>
              {locs.map((l) => <option key={l.maKho} value={l.maKho}>{l.tenKho}</option>)}
            </select>
          </label>
          <label style={{ flex: 1, minWidth: 220 }}>Danh sách maSku (cách nhau dấu phẩy)
            <input value={skuText} onChange={(e) => setSkuText(e.target.value)} placeholder="8, 9, 10" style={{ display: "block", width: "100%", border: "1px solid var(--line)", borderRadius: 10, padding: "9px 12px", marginTop: 4 }} />
          </label>
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
          <button className="mpTopBtn primary" type="button" disabled={busy} onClick={createBaseline}>Lấy baseline &amp; tạo phiếu đếm</button>
          {draft ? <button className="mpTopBtn" type="button" onClick={freshBaseline}>Baseline mới (bỏ phiếu này)</button> : null}
        </div>
      </div>

      <WhErrorBox error={error} />
      {notice ? <p className="mpPreviewBar" role="status">{notice}</p> : null}

      {draft ? (
        <div className="mpCard" aria-label={`Phiếu kiểm #${draft.maPhieu}`}>
          <h2>Phiếu kiểm #{draft.maPhieu} · {draft.trangThai === "BAN_NHAP" ? "Bản nháp" : draft.trangThai === "DA_XAC_NHAN" ? "Đã chốt" : "Đã hủy"}</h2>
          {draft.trangThai !== "BAN_NHAP" ? (
            <p className="mpMuted">Phiếu đã kết thúc — {draft.maPhieuLienKet ? `phiếu cân bằng liên kết #${draft.maPhieuLienKet}.` : "không chênh lệch."}</p>
          ) : (
            <>
              <div className="mpTableWrap">
                <table className="mpTable">
                  <thead><tr><th>SKU</th><th>Tồn cơ sở (baseline)</th><th>Phiên bản cơ sở</th><th>Số đếm vật lý</th></tr></thead>
                  <tbody>
                    {draft.items.map((it) => {
                      const row = counts.find((c) => c.maSku === it.maSku);
                      return (
                        <tr key={it.maSku}>
                          <td><b>#{it.maSku}</b></td>
                          <td><b>{it.tonCoSo ?? "—"}</b></td>
                          <td className="adMono">v{it.phienBanCoSo ?? "—"}</td>
                          <td>
                            <input
                              value={row?.soDem ?? ""}
                              onChange={(e) => setCounts((prev) => prev.map((c) => (c.maSku === it.maSku ? { ...c, soDem: e.target.value } : c)))}
                              inputMode="numeric"
                              placeholder="0 hợp lệ"
                              aria-label={`Số đếm SKU ${it.maSku}`}
                              style={{ width: 110, border: "1px solid var(--line)", borderRadius: 8, padding: "8px 10px" }}
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                <button className="mpTopBtn" type="button" disabled={busy} onClick={saveCounts}>Ghi số đếm</button>
                <button className="mpTopBtn primary" type="button" disabled={busy} onClick={confirm}>Xác nhận chốt</button>
              </div>
            </>
          )}
        </div>
      ) : null}
    </MerchantShell>
  );
}
