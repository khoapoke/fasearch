"use client";

import { useEffect, useState } from "react";
import { MerchantShell } from "@/components/merchant/merchant-shell";
import { WhAuthNote, WhErrorBox, toWhError } from "@/components/merchant/wh";
import { readOwnIdentity, type AccountIdentity } from "@/components/account/account-session";
import { unwrap, whFetch, whWrite, type KhoDiaDiem, type WhError } from "@/lib/wh-client";

export default function LocationsPage() {
  const [me, setMe] = useState<AccountIdentity | null>(null);
  const [locs, setLocs] = useState<KhoDiaDiem[]>([]);
  const [error, setError] = useState<WhError | null>(null);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [tenKho, setTenKho] = useState("");
  const [diaChi, setDiaChi] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [nguong, setNguong] = useState<Record<string, string>>({});

  const isAdmin = me?.role === "ADMIN";

  useEffect(() => {
    let live = true;
    readOwnIdentity()
      .then((identity) => live && setMe(identity))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);

  useEffect(() => {
    let live = true;
    whFetch("v1/kho/dia-diem")
      .then(async (r) => {
        if (!r.ok) {
          if (live) setError(await toWhError(r));
          return;
        }
        if (live) {
          setLocs(await unwrap<KhoDiaDiem[]>(r));
          setError(null);
        }
      })
      .catch(() => {
        if (live) setError({ status: 0, code: "NETWORK", message: "Không kết nối được máy chủ kho.", errors: [] });
      });
    return () => {
      live = false;
    };
  }, [reloadKey]);

  async function create() {
    if (busy || !isAdmin) return;
    if (!tenKho.trim()) {
      setError({ status: 0, code: "LOCAL", message: "Nhập tên kho (duy nhất).", errors: [] });
      return;
    }
    setBusy(true);
    try {
      const r = await whWrite("v1/kho/dia-diem", "POST", { tenKho: tenKho.trim(), diaChi: diaChi.trim() || undefined });
      if (!r.ok) setError(await toWhError(r));
      else {
        setTenKho("");
        setDiaChi("");
        setNotice("Đã tạo kho mới.");
        setReloadKey((k) => k + 1);
      }
    } catch {
      setError({ status: 0, code: "NETWORK", message: "Không kết nối được máy chủ kho.", errors: [] });
    } finally {
      setBusy(false);
    }
  }

  async function saveNguong(maSku: string, maKho: number) {
    if (busy || !isAdmin) return;
    const raw = (nguong[`${maSku}-${maKho}`] ?? "").trim();
    if (!/^\d+$/.test(maSku) || raw === "") {
      setError({ status: 0, code: "LOCAL", message: "Nhập maSku số và ngưỡng ≥ 0 (bỏ trống ngưỡng ở ô khác).", errors: [] });
      return;
    }
    setBusy(true);
    try {
      const r = await whWrite(`v1/kho/ton/${maSku}/${maKho}/nguong`, "PATCH", { nguong: Number(raw) });
      if (!r.ok) setError(await toWhError(r));
      else {
        setNotice(`Đã đặt ngưỡng SKU #${maSku} tại kho #${maKho} = ${raw}. Máy chủ đánh giá lại episode ngay.`);
        setError(null);
      }
    } catch {
      setError({ status: 0, code: "NETWORK", message: "Không kết nối được máy chủ kho.", errors: [] });
    } finally {
      setBusy(false);
    }
  }

  async function clearNguong(maSku: string, maKho: number) {
    if (busy || !isAdmin) return;
    if (!/^\d+$/.test(maSku)) return;
    setBusy(true);
    try {
      const r = await whWrite(`v1/kho/ton/${maSku}/${maKho}/nguong`, "PATCH", { nguong: null });
      if (!r.ok) setError(await toWhError(r));
      else {
        setNotice(`Đã tắt cảnh báo (ngưỡng null) cho SKU #${maSku} tại kho #${maKho}.`);
        setError(null);
      }
    } catch {
      setError({ status: 0, code: "NETWORK", message: "Không kết nối được máy chủ kho.", errors: [] });
    } finally {
      setBusy(false);
    }
  }

  return (
    <MerchantShell active="locations">
      <div className="mpCard">
        <h2>Kho &amp; Ngưỡng tồn</h2>
        <p className="mpMuted">
          Xem kho: STAFF/ADMIN. Tạo kho + đặt ngưỡng: <b>ADMIN duy nhất</b>.
          Ngưỡng null = tắt cảnh báo; 0 = báo khi hết hàng.
        </p>
        <WhAuthNote role={me?.role ?? null} />
        {!isAdmin && me ? (
          <p className="mpPreviewBar" role="note">Bạn là {me.role} — form tạo kho/ngưỡng bị khóa, chỉ xem danh sách.</p>
        ) : null}
      </div>
      <WhErrorBox error={error} />
      {notice ? <p className="mpPreviewBar" role="status">{notice}</p> : null}

      <div className="mpCard">
        <h2>Địa điểm ({locs.length})</h2>
        {locs.length === 0 ? (
          <p className="mpMuted">Chưa tải được danh sách kho (xem lỗi ở trên).</p>
        ) : (
          <div className="mpTableWrap">
            <table className="mpTable">
              <thead><tr><th>Mã kho</th><th>Tên kho</th><th>Địa chỉ</th><th>Trạng thái</th><th>Mặc định</th></tr></thead>
              <tbody>
                {locs.map((l) => (
                  <tr key={l.maKho}>
                    <td><b>#{l.maKho}</b></td>
                    <td><b>{l.tenKho}</b></td>
                    <td>{l.diaChi ?? "—"}</td>
                    <td>{l.trangThai === "HOAT_DONG" ? <span className="mpPill mpPillLive">Hoạt động</span> : <span className="mpPill mpPillWarn">Ngưng</span>}</td>
                    <td>{l.laMacDinh ? "Mặc định" : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
          <input value={tenKho} onChange={(e) => setTenKho(e.target.value)} maxLength={150} placeholder="Tên kho mới*" aria-label="Tên kho mới" disabled={!isAdmin} style={{ border: "1px solid var(--line)", borderRadius: 10, padding: "10px 12px" }} />
          <input value={diaChi} onChange={(e) => setDiaChi(e.target.value)} placeholder="Địa chỉ" aria-label="Địa chỉ kho" disabled={!isAdmin} style={{ border: "1px solid var(--line)", borderRadius: 10, padding: "10px 12px" }} />
          <button className="mpTopBtn primary" type="button" disabled={busy || !isAdmin} onClick={create} title={isAdmin ? undefined : "Chỉ ADMIN"}>Tạo kho</button>
        </div>
      </div>

      <div className="mpCard">
        <h2>Đặt ngưỡng SKU × kho</h2>
        <p className="mpMuted">Đổi ngưỡng xong máy chủ đánh giá lại episode ngay trong cùng transaction.</p>
        <ThresholdForm
          disabled={busy || !isAdmin}
          nguong={nguong}
          setNguong={setNguong}
          onSave={saveNguong}
          onClear={clearNguong}
        />
      </div>
    </MerchantShell>
  );
}

function ThresholdForm({
  disabled,
  nguong,
  setNguong,
  onSave,
  onClear,
}: {
  disabled: boolean;
  nguong: Record<string, string>;
  setNguong: (n: Record<string, string>) => void;
  onSave: (maSku: string, maKho: number) => void;
  onClear: (maSku: string, maKho: number) => void;
}) {
  const [maSku, setMaSku] = useState("");
  const [maKho, setMaKho] = useState("");
  const key = `${maSku.trim()}-${maKho.trim()}`;
  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
      <input value={maSku} onChange={(e) => setMaSku(e.target.value)} placeholder="maSku*" aria-label="Mã SKU" inputMode="numeric" disabled={disabled} style={{ border: "1px solid var(--line)", borderRadius: 10, padding: "10px 12px", maxWidth: 130 }} />
      <input value={maKho} onChange={(e) => setMaKho(e.target.value)} placeholder="maKho*" aria-label="Mã kho" inputMode="numeric" disabled={disabled} style={{ border: "1px solid var(--line)", borderRadius: 10, padding: "10px 12px", maxWidth: 130 }} />
      <input
        value={nguong[key] ?? ""}
        onChange={(e) => setNguong({ ...nguong, [key]: e.target.value })}
        placeholder="ngưỡng ≥ 0"
        aria-label="Ngưỡng tối thiểu"
        inputMode="numeric"
        disabled={disabled}
        style={{ border: "1px solid var(--line)", borderRadius: 10, padding: "10px 12px", maxWidth: 150 }}
      />
      <button className="mpTopBtn primary" type="button" disabled={disabled} onClick={() => onSave(maSku.trim(), Number(maKho))}>Đặt ngưỡng</button>
      <button className="mpTopBtn" type="button" disabled={disabled} onClick={() => onClear(maSku.trim(), Number(maKho))}>Tắt (null)</button>
    </div>
  );
}
