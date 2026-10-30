"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AdminShell } from "@/components/admin/admin-shell";
import { addCampaignCode, createCampaign, fetchCampaign, fetchCampaigns, updateCampaign, type Campaign } from "@/lib/promotions-client";
import { benefitErrorMessage } from "@/lib/benefits";

type ListState =
  | { kind: "loading" }
  | { kind: "ready"; rows: Campaign[]; total: number }
  | { kind: "error"; message: string; status: number };

function stateLabel(s: string): string {
  switch (s) {
    case "NHAP": return "Nháp";
    case "HOAT_DONG": return "Đang chạy";
    case "TAM_DUNG": return "Tạm dừng";
    case "HET_HAN": return "Hết hạn";
    default: return s;
  }
}

function fmtDateTime(value: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d+))?$/.exec(value);
  return m ? `${m[3]}/${m[2]}/${m[1]} ${m[4]}:${m[5]}:${m[6]}${m[7] ? `.${m[7]}` : ""} HCM` : value;
}
function wireDateTime(value: string): string { return value.length === 16 ? `${value}:00` : value; }
function inputDateTime(value: string): string { return value; }
function hcmTime(value: string): number { return Date.parse(`${wireDateTime(value)}+07:00`); }
function parseSpIds(raw: string): number[] | undefined {
  const ids = raw.split(/[,\s]+/).map((s) => s.trim()).filter(Boolean).map(Number);
  if (ids.some((n) => !Number.isSafeInteger(n) || n <= 0)) return undefined;
  return ids;
}

export default function CampaignsPage() {
  const [loai, setLoai] = useState("");
  const [trangThai, setTrangThai] = useState("");
  const [page, setPage] = useState(0);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [list, setList] = useState<ListState>({ kind: "loading" });
  const [openId, setOpenId] = useState<number | null>(null);
  const [detail, setDetail] = useState<Campaign | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ tenCtkm: "", loaiGiam: "PHAN_TRAM", giaTriGiam: "", ngayBatDau: "", ngayKetThuc: "", maSpApDung: "", dieuKienApDung: "" });
  const [formIssue, setFormIssue] = useState("");
  const [codeForm, setCodeForm] = useState({ maCode: "", soLuong: "" });
  const [createdCode, setCreatedCode] = useState("");
  const [busy, setBusy] = useState(false);
  const errorRef = useRef<HTMLDivElement>(null);
  const size = 10;

  const load = useCallback(async () => {
    setList({ kind: "loading" });
    try {
      const qs = new URLSearchParams({ page: String(page), size: String(size) });
      if (loai) qs.set("loai", loai);
      if (trangThai) qs.set("trangThai", trangThai);
      if (search) qs.set("q", search);
      const pg = await fetchCampaigns(qs.toString());
      setList({ kind: "ready", rows: pg.data, total: pg.totalElements });
    } catch (e) {
      const st = (e as { status?: number })?.status ?? 0;
      setList({ kind: "error", message: benefitErrorMessage(st, null, e instanceof Error ? e.message : "Không tải được chiến dịch."), status: st });
      setTimeout(() => errorRef.current?.focus(), 0);
    }
  }, [loai, trangThai, page, search]);

  useEffect(() => {
    void Promise.resolve().then(() => load());
  }, [load]);

  async function open(id: number) {
    setOpenId(id);
    setDetail(null);
    try {
      setDetail(await fetchCampaign(id));
    } catch (e) {
      const st = (e as { status?: number })?.status ?? 0;
      setList({ kind: "error", message: benefitErrorMessage(st, null, "Không tải được chi tiết."), status: st });
    }
  }

  async function submitCreate() {
    const tenCtkm = form.tenCtkm.trim();
    if (!tenCtkm) {
      setFormIssue("Nhập tên chương trình.");
      return;
    }
    const giaTriGiam = Number(form.giaTriGiam);
    if (!Number.isFinite(giaTriGiam) || giaTriGiam <= 0) {
      setFormIssue("Giá trị giảm phải là số dương.");
      return;
    }
    if (form.loaiGiam === "PHAN_TRAM" && giaTriGiam > 100) {
      setFormIssue("Giảm theo % không vượt quá 100.");
      return;
    }
    if (!form.ngayBatDau || !form.ngayKetThuc || !Number.isFinite(hcmTime(form.ngayBatDau)) || !Number.isFinite(hcmTime(form.ngayKetThuc)) || hcmTime(form.ngayBatDau) >= hcmTime(form.ngayKetThuc)) {
      setFormIssue("Ngày bắt đầu phải trước ngày kết thúc.");
      return;
    }
    const maSpApDung = parseSpIds(form.maSpApDung);
    if (form.maSpApDung.trim() && maSpApDung === undefined) {
      setFormIssue("Mã sản phẩm áp dụng: danh sách ID số nguyên, cách nhau bởi dấu phẩy (để trống = tất cả).");
      return;
    }
    setFormIssue("");
    setBusy(true);
    try {
      await createCampaign({
        tenCtkm, loaiGiam: form.loaiGiam as Campaign["loaiGiam"], giaTriGiam,
        ngayBatDau: wireDateTime(form.ngayBatDau),
        ngayKetThuc: wireDateTime(form.ngayKetThuc),
        ...(form.dieuKienApDung.trim() ? { dieuKienApDung: form.dieuKienApDung.trim() } : {}),
        ...(maSpApDung !== undefined ? { maSpApDung } : {}),
      });
      setCreating(false);
      setForm({ tenCtkm: "", loaiGiam: "PHAN_TRAM", giaTriGiam: "", ngayBatDau: "", ngayKetThuc: "", maSpApDung: "", dieuKienApDung: "" });
      load();
    } catch (e) {
      const st = (e as { status?: number })?.status ?? 0;
      setFormIssue(benefitErrorMessage(st, null, e instanceof Error ? e.message : "Tạo thất bại."));
    } finally {
      setBusy(false);
    }
  }

  async function togglePause() {
    if (!detail || busy) return;
    const next: "HOAT_DONG" | "TAM_DUNG" = detail.trangThai === "TAM_DUNG" ? "HOAT_DONG" : "TAM_DUNG";
    setBusy(true);
    setFormIssue("");
    try {
      const updated = await updateCampaign(detail.maKm, { phienBan: detail.phienBan, trangThai: next });
      setDetail(updated);
      load();
    } catch (e) {
      const st = (e as { status?: number })?.status ?? 0;
      setFormIssue(st === 409
        ? "Chiến dịch đã đổi (phiên bản/quota) — tải lại chi tiết rồi làm tiếp, không tự thử lại."
        : benefitErrorMessage(st, null, e instanceof Error ? e.message : "Đổi trạng thái thất bại."));
    } finally {
      setBusy(false);
    }
  }

  async function submitCode() {
    if (!detail || busy) return;
    const maCode = codeForm.maCode.trim().toUpperCase();
    if (!maCode) {
      setFormIssue("Nhập mã code (tự UPPER).");
      return;
    }
    const soLuong = codeForm.soLuong.trim() ? Number(codeForm.soLuong) : null;
    if (soLuong !== null && (!Number.isInteger(soLuong) || soLuong <= 0)) {
      setFormIssue("Số lượng phát hành phải là số nguyên > 0 (để trống = không giới hạn).");
      return;
    }
    setBusy(true);
    setFormIssue("");
    try {
      const created = await addCampaignCode(detail.maKm, { maCode, soLuongPhatHanh: soLuong });
      setCreatedCode(`${created.maCode} (đã dùng ${created.daSuDung} · đang giữ ${created.soLuongGiuCho} / ${created.soLuongPhatHanh ?? "∞"})`);
      open(detail.maKm);
      setCodeForm({ maCode: "", soLuong: "" });
      load();
    } catch (e) {
      const st = (e as { status?: number })?.status ?? 0;
      setFormIssue(benefitErrorMessage(st, null, e instanceof Error ? e.message : "Thêm mã thất bại."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AdminShell
      active="campaigns"
      crumbs={[{ label: "Quản trị", href: "/quan-tri/tai-khoan" }, { label: "Khuyến mãi & Voucher" }]}
      title="Khuyến mãi & Voucher"
      lede="Tạo/sửa/tạm dừng chương trình theo phiên bản. Đơn đã chốt giữ nguyên deal."
      actions={<button className="adBtn adBtnPrimary" type="button" onClick={() => setCreating((v) => !v)}>{creating ? "Đóng form" : "Tạo chương trình"}</button>}
    >
      {creating ? (
        <section className="adCard" aria-label="Tạo chương trình">
          <h2 style={{ fontSize: 15, fontWeight: 800, marginBottom: 10 }}>Chương trình mới</h2>
          <div className="adFilters">
            <input value={form.tenCtkm} onChange={(e) => setForm({ ...form, tenCtkm: e.target.value })} placeholder="Tên chương trình *" aria-label="Tên" style={{ minWidth: 220 }} />
            <select value={form.loaiGiam} onChange={(e) => setForm({ ...form, loaiGiam: e.target.value })} aria-label="Loại giảm">
              <option value="PHAN_TRAM">% theo đơn</option>
              <option value="SO_TIEN">Tiền cố định</option>
            </select>
            <input value={form.giaTriGiam} onChange={(e) => setForm({ ...form, giaTriGiam: e.target.value })} placeholder="Giá trị *" aria-label="Giá trị" inputMode="decimal" style={{ width: 130 }} />
            <input type="datetime-local" step="any" value={form.ngayBatDau} onChange={(e) => setForm({ ...form, ngayBatDau: e.target.value })} aria-label="Bắt đầu" />
            <input type="datetime-local" step="any" value={form.ngayKetThuc} onChange={(e) => setForm({ ...form, ngayKetThuc: e.target.value })} aria-label="Kết thúc" />
            <input value={form.dieuKienApDung} onChange={(e) => setForm({ ...form, dieuKienApDung: e.target.value })} placeholder="Điều kiện (tùy chọn)" aria-label="Điều kiện" style={{ minWidth: 220 }} />
            <input value={form.maSpApDung} onChange={(e) => setForm({ ...form, maSpApDung: e.target.value })} placeholder="Mã SP áp dụng (1,2,3; trống=tất cả)" aria-label="Sản phẩm áp dụng" style={{ minWidth: 220 }} />
            <button className="adBtn adBtnPrimary" type="button" disabled={busy} onClick={submitCreate}>{busy ? "Đang tạo…" : "Tạo"}</button>
          </div>
          <p className="adNote">Mã code phát hành riêng ở chi tiết chương trình sau khi tạo.</p>
          {formIssue ? <p className="adNote" role="alert">{formIssue}</p> : null}
        </section>
      ) : null}
      <section className="adCard" aria-label="Lọc chiến dịch">
        <form className="adFilters" role="search" onSubmit={(e) => { e.preventDefault(); setPage(0); setSearch(searchInput.trim()); }}>
          <input value={searchInput} onChange={(e) => setSearchInput(e.target.value)} maxLength={100} placeholder="Tìm tên chiến dịch" aria-label="Tìm tên chiến dịch" />
          <select value={loai} onChange={(e) => { setLoai(e.target.value); setPage(0); }} aria-label="Loại">
            <option value="">Mọi loại</option>
            <option value="PHAN_TRAM">% theo đơn</option>
            <option value="SO_TIEN">Tiền cố định</option>
          </select>
          <select value={trangThai} onChange={(e) => { setTrangThai(e.target.value); setPage(0); }} aria-label="Trạng thái">
            <option value="">Mọi trạng thái</option>
            <option value="HOAT_DONG">Đang chạy</option>
            <option value="TAM_DUNG">Tạm dừng</option>
          </select>
          <button className="adBtn" type="submit">Lọc (giữ điều kiện)</button>
        </form>
      </section>
      <section className="adCard" aria-label="Danh sách chiến dịch">
        {list.kind === "loading" ? <p className="adState" role="status">Đang tải chiến dịch…</p> : null}
        {list.kind === "error" ? (
          <div ref={errorRef} tabIndex={-1} role="alert">
            <p className="adNote">{list.message}</p>
            <button className="adBtn" type="button" onClick={load}>Thử lại (giữ lọc)</button>
          </div>
        ) : null}
        {list.kind === "ready" ? (
          list.rows.length === 0 ? <p className="adState">Chưa có chiến dịch nào với bộ lọc hiện tại.</p> : (
            <div className="adTableWrap">
              <table className="adTable">
                <thead><tr><th>Mã KM</th><th>Tên</th><th>Mức giảm</th><th>Thời gian</th><th>Trạng thái</th><th style={{ textAlign: "right" }}>Thao tác</th></tr></thead>
                <tbody>
                  {list.rows.map((c) => (
                    <tr key={c.maKm} data-selected={openId === c.maKm}>
                      <td className="adMono">#{c.maKm}</td>
                      <td><b>{c.tenCtkm}</b></td>
                      <td>{c.loaiGiam === "PHAN_TRAM" ? `${c.giaTriGiam}%` : `${Number(c.giaTriGiam).toLocaleString("vi-VN")}₫`}</td>
                      <td className="adMono">{fmtDateTime(c.ngayBatDau)} → {fmtDateTime(c.ngayKetThuc)}</td>
                      <td>{stateLabel(c.trangThai)}</td>
                      <td><span className="adRowBtns"><button className="adBtn" type="button" onClick={() => open(c.maKm)}>Chi tiết</button></span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : null}
        {list.kind === "ready" && list.total > size ? (
          <p className="adPager">
            <button className="adBtn" disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>Trước</button>
            <span>Trang {page + 1} · {list.total}</span>
            <button className="adBtn" onClick={() => setPage((p) => p + 1)}>Sau</button>
          </p>
        ) : null}
      </section>
      {openId !== null ? (
        <section className="adCard" role="dialog" aria-label={`Chi tiết chiến dịch #${openId}`}>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <h2 style={{ fontSize: 15, fontWeight: 800 }}>Chiến dịch #{openId}</h2>
            <button className="adBtn" style={{ marginLeft: "auto" }} onClick={() => { setOpenId(null); setDetail(null); setCreatedCode(""); }}>Đóng</button>
          </div>
          {!detail ? <p className="adState" role="status">Đang tải chi tiết…</p> : (
            <>
              <p className="adNote">Phiên bản {detail.phienBan} · {stateLabel(detail.trangThai)} · Sửa/tạm dừng tạo phiên bản mới, đơn đã chốt giữ nguyên.</p>
              <p><b>{detail.tenCtkm}</b> — {detail.loaiGiam === "PHAN_TRAM" ? `${detail.giaTriGiam}%` : `${Number(detail.giaTriGiam).toLocaleString("vi-VN")}₫`}</p>
              <p className="adNote">{fmtDateTime(detail.ngayBatDau)} → {fmtDateTime(detail.ngayKetThuc)}
                {detail.maSpApDung?.length ? ` · SP: ${detail.maSpApDung.join(", ")}` : " · Mọi sản phẩm"}</p>
              {createdCode ? <p className="adMono">Đã phát hành: {createdCode}</p> : null}
              {formIssue ? <p className="adNote" role="alert">{formIssue}</p> : null}
              <EditCampaignForm key={`${detail.maKm}:${detail.phienBan}`} campaign={detail} onSaved={(c) => { setDetail(c); load(); }} />
              <div className="adFilters" style={{ marginTop: 8 }}>
                <input value={codeForm.maCode} onChange={(e) => setCodeForm({ ...codeForm, maCode: e.target.value })} maxLength={50} placeholder="Mã code mới" aria-label="Mã code mới" style={{ textTransform: "uppercase" }} />
                <input value={codeForm.soLuong} onChange={(e) => setCodeForm({ ...codeForm, soLuong: e.target.value })} placeholder="SL (trống=∞)" aria-label="Số lượng" inputMode="numeric" style={{ width: 110 }} />
                <button className="adBtn" type="button" disabled={busy} onClick={submitCode}>Phát hành mã</button>
                <button className="adBtn adBtnPrimary" type="button" disabled={busy} onClick={togglePause}>
                  {detail.trangThai === "TAM_DUNG" ? "Mở lại (tiếp tục chạy)" : "Tạm dừng (giữ đơn đã chốt)"}
                </button>
                <button className="adBtn" type="button" disabled={busy} onClick={() => open(detail.maKm)}>Tải lại chi tiết</button>
              </div>
              <div className="adTableWrap" style={{ marginTop: 12 }}>
                <table className="adTable"><caption>Mã đã phát hành; lượt dùng và lượt giữ do máy chủ quản lý.</caption><thead><tr><th>Mã</th><th>Trạng thái</th><th>Đã dùng</th><th>Đang giữ</th><th>Phát hành</th></tr></thead><tbody>
                  {detail.codes.map((code) => <tr key={code.maVoucher}><td className="adMono">{code.maCode}</td><td>{code.trangThai}</td><td>{code.daSuDung}</td><td>{code.soLuongGiuCho}</td><td>{code.soLuongPhatHanh ?? "Không giới hạn"}</td></tr>)}
                </tbody></table>
                {detail.codes.length === 0 ? <p className="adState">Chưa phát hành mã cho chiến dịch này.</p> : null}
              </div>
            </>
          )}
        </section>
      ) : null}
    </AdminShell>
  );
}

function EditCampaignForm({ campaign, onSaved }: { campaign: Campaign; onSaved: (c: Campaign) => void }) {
  const [form, setForm] = useState({ tenCtkm: campaign.tenCtkm, loaiGiam: campaign.loaiGiam, giaTriGiam: String(campaign.giaTriGiam), ngayBatDau: inputDateTime(campaign.ngayBatDau), ngayKetThuc: inputDateTime(campaign.ngayKetThuc), dieuKienApDung: campaign.dieuKienApDung ?? "", maSpApDung: campaign.maSpApDung.join(", ") });
  const [issue, setIssue] = useState("");
  const [busy, setBusy] = useState(false);
  async function save() {
    const tenCtkm = form.tenCtkm.trim();
    const giaTriGiam = Number(form.giaTriGiam);
    const maSpApDung = parseSpIds(form.maSpApDung);
    if (!tenCtkm || !Number.isFinite(giaTriGiam) || giaTriGiam <= 0 || (form.loaiGiam === "PHAN_TRAM" && giaTriGiam > 100) || !form.ngayBatDau || !form.ngayKetThuc || !Number.isFinite(hcmTime(form.ngayBatDau)) || !Number.isFinite(hcmTime(form.ngayKetThuc)) || hcmTime(form.ngayBatDau) >= hcmTime(form.ngayKetThuc) || maSpApDung === undefined) {
      setIssue("Kiểm tra tên, mức giảm, khoảng thời gian và danh sách sản phẩm.");
      return;
    }
    setBusy(true); setIssue("");
    try {
      onSaved(await updateCampaign(campaign.maKm, { phienBan: campaign.phienBan, tenCtkm, loaiGiam: form.loaiGiam, giaTriGiam, ngayBatDau: wireDateTime(form.ngayBatDau), ngayKetThuc: wireDateTime(form.ngayKetThuc), dieuKienApDung: form.dieuKienApDung, maSpApDung }));
    } catch (e) {
      const st = (e as { status?: number })?.status ?? 0;
      setIssue(st === 409 ? "Chiến dịch đã đổi — tải lại chi tiết rồi sửa tiếp." : benefitErrorMessage(st, null, e instanceof Error ? e.message : "Lưu thất bại."));
    } finally { setBusy(false); }
  }
  return <div style={{ marginTop: 10 }}>
    <h3 style={{ fontSize: 13.5, fontWeight: 800 }}>Sửa chiến dịch · lưu thành phiên bản mới</h3>
    <div className="adFilters" style={{ marginTop: 6 }}>
      <input value={form.tenCtkm} onChange={(e) => setForm({ ...form, tenCtkm: e.target.value })} aria-label="Tên mới" />
      <select value={form.loaiGiam} onChange={(e) => setForm({ ...form, loaiGiam: e.target.value as Campaign["loaiGiam"] })} aria-label="Loại giảm mới"><option value="PHAN_TRAM">% theo đơn</option><option value="SO_TIEN">Tiền cố định</option></select>
      <input value={form.giaTriGiam} onChange={(e) => setForm({ ...form, giaTriGiam: e.target.value })} aria-label="Giá trị mới" inputMode="decimal" style={{ width: 130 }} />
      <input type="datetime-local" step="any" value={form.ngayBatDau} onChange={(e) => setForm({ ...form, ngayBatDau: e.target.value })} aria-label="Bắt đầu mới" />
      <input type="datetime-local" step="any" value={form.ngayKetThuc} onChange={(e) => setForm({ ...form, ngayKetThuc: e.target.value })} aria-label="Kết thúc mới" />
      <input value={form.dieuKienApDung} onChange={(e) => setForm({ ...form, dieuKienApDung: e.target.value })} aria-label="Điều kiện mới" placeholder="Điều kiện hiển thị" />
      <input value={form.maSpApDung} onChange={(e) => setForm({ ...form, maSpApDung: e.target.value })} aria-label="Sản phẩm áp dụng mới" placeholder="ID sản phẩm, trống=tất cả" />
      <button className="adBtn" type="button" disabled={busy} onClick={save}>{busy ? "Đang lưu…" : "Lưu phiên bản mới"}</button>
    </div>
    {issue ? <p className="adNote" role="alert">{issue}</p> : null}
  </div>;
}
