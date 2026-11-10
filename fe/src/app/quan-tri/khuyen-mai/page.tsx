"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AdminShellB } from "@/components/admin-b/admin-shell";
import { AdminModal } from "@/components/admin-b/modal";
import { InfoHint } from "@/components/admin-b/info-hint";
import { PageHeader } from "@/components/admin-b/page-header";
import { TableSkeleton } from "@/components/admin-b/skeleton";
import { StatusBadge, type Tone } from "@/components/admin-b/status-badge";
import { useToast } from "@/components/admin-b/toast";
import { useAdminCan } from "@/components/admin-b/use-admin-role";
import { Pager } from "@/components/admin-b/pagination";
import { formatDateTime, formatNumber } from "@/lib/admin-format";
import { addCampaignCode, createCampaign, fetchCampaign, fetchCampaigns, updateCampaign, type Campaign, type PromotionCode } from "@/lib/promotions-client";
import { benefitErrorMessage } from "@/lib/benefits";

type ListState =
  | { kind: "loading" }
  | { kind: "ready"; rows: Campaign[]; total: number }
  | { kind: "error"; message: string; status: number };

type StateTone = Tone;

function stateLabel(s: string): string {
  switch (s) {
    case "NHAP": return "Draft";
    case "HOAT_DONG": return "Đang chạy";
    case "TAM_DUNG": return "Tạm dừng";
    case "HET_HAN": return "Hết hạn";
    default: return s;
  }
}
function codeStatusLabel(s: string): string {
  if (s === "ACTIVE") return "Đang hoạt động";
  return s;
}

/** dd/MM/yyyy HH:mm, không microsecond, không hậu tố múi giờ. */
const fmtDateTime = formatDateTime;
function wireDateTime(value: string): string { return value.length === 16 ? `${value}:00` : value; }
function wireTime(value: string): number { return Date.parse(`${wireDateTime(value)}+07:00`); }
/** dd/mm/yyyy hh:mm → the wire value the BE expects; null when not parseable. */
function inputToWire(value: string): string | null {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!m) return null;
  const day = Number(m[1]), month = Number(m[2]), year = Number(m[3]), hour = Number(m[4]), minute = Number(m[5]);
  if (month < 1 || month > 12 || day < 1 || day > 31 || hour > 23 || minute > 59) return null;
  const check = new Date(Date.UTC(year, month - 1, day));
  if (check.getUTCFullYear() !== year || check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day) return null;
  return `${m[3]}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00`;
}
function inputTime(value: string): number { const wire = inputToWire(value); return wire ? Date.parse(`${wire}+07:00`) : NaN; }
function parseSpIds(raw: string): number[] | undefined {
  const ids = raw.split(/[,\s]+/).map((s) => s.trim()).filter(Boolean).map(Number);
  if (ids.some((n) => !Number.isSafeInteger(n) || n <= 0)) return undefined;
  return ids;
}

function clockNow(): number { return Date.now(); }

function discountLabel(c: Pick<Campaign, "loaiGiam" | "giaTriGiam">): string {
  if (c.loaiGiam === "FREE_SHIP") return "Miễn phí giao hàng";
  if (c.loaiGiam === "PHAN_TRAM") return `${c.giaTriGiam}%`;
  return `${formatNumber(c.giaTriGiam)} VND`;
}

/** Hiệu lực thật tại thời điểm xem, chỉ tính từ ngày bắt đầu/kết thúc đã có. */
function campaignPhase(c: Pick<Campaign, "ngayBatDau" | "ngayKetThuc">, now: number): "upcoming" | "running" | "ended" {
  const start = wireTime(c.ngayBatDau);
  const end = wireTime(c.ngayKetThuc);
  if (Number.isFinite(end) && now > end) return "ended";
  if (Number.isFinite(start) && now < start) return "upcoming";
  return "running";
}
function effectiveStatus(c: Campaign, now: number): { label: string; tone: StateTone; storedDiffers: boolean } {
  const phase = campaignPhase(c, now);
  const stored = stateLabel(c.trangThai);
  if (phase === "ended") return { label: "Đã kết thúc", tone: "gray", storedDiffers: stored !== "Đã kết thúc" };
  if (phase === "upcoming") return { label: "Chưa bắt đầu", tone: "blue", storedDiffers: stored !== "Chưa bắt đầu" };
  if (c.trangThai === "TAM_DUNG") return { label: "Tạm dừng", tone: "amber", storedDiffers: false };
  return { label: "Đang chạy", tone: "green", storedDiffers: stored !== "Đang chạy" };
}


type FormValues = { tenCtkm: string; loaiGiam: string; giaTriGiam: string; ngayBatDau: string; ngayKetThuc: string; maSpApDung: string; dieuKienApDung: string };
const EMPTY_FORM: FormValues = { tenCtkm: "", loaiGiam: "PHAN_TRAM", giaTriGiam: "", ngayBatDau: "", ngayKetThuc: "", maSpApDung: "", dieuKienApDung: "" };

function valueHint(loai: string): string {
  return loai === "PHAN_TRAM" ? "Phần trăm giảm trên giá trị đơn, tối đa 100%." : loai === "SO_TIEN" ? "Số tiền giảm cố định cho mỗi đơn, đơn vị VND." : "Miễn phí giao hàng cho đơn áp dụng; không cần nhập giá trị.";
}

/** Same fields for create and edit: name, discount and the two dates share one row. */
function CampaignFields({ prefix, form, setForm }: { prefix: string; form: FormValues; setForm: (next: FormValues) => void }) {
  return (
    <>
      <div className="catalog-field">
        <label htmlFor={`${prefix}-name`}>Tên chương trình *</label>
        <input id={`${prefix}-name`} className="catalog-input" value={form.tenCtkm} onChange={(e) => setForm({ ...form, tenCtkm: e.target.value })} />
      </div>
      <div className="l3-grid4">
        <div className="catalog-field">
          <label htmlFor={`${prefix}-type`}>Loại giảm</label>
          <select id={`${prefix}-type`} className="catalog-input" value={form.loaiGiam} onChange={(e) => setForm({ ...form, loaiGiam: e.target.value })}>
            <option value="PHAN_TRAM">% theo đơn</option>
            <option value="SO_TIEN">Tiền cố định</option>
            <option value="FREE_SHIP">Miễn phí giao hàng</option>
          </select>
        </div>
        <div className="catalog-field">
          <label htmlFor={`${prefix}-value`}>Giá trị * <InfoHint label="Giải thích giá trị">{valueHint(form.loaiGiam)}</InfoHint></label>
          <input id={`${prefix}-value`} className="catalog-input" disabled={form.loaiGiam === "FREE_SHIP"} value={form.loaiGiam === "FREE_SHIP" ? "Miễn phí giao hàng" : form.giaTriGiam} onChange={(e) => setForm({ ...form, giaTriGiam: e.target.value })} placeholder="Ví dụ: 10" inputMode="decimal" />
        </div>
        <div className="catalog-field">
          <label htmlFor={`${prefix}-start`}>Bắt đầu *</label>
          <input id={`${prefix}-start`} className="catalog-input" type="text" inputMode="numeric" placeholder="dd/mm/yyyy hh:mm" value={form.ngayBatDau} onChange={(e) => setForm({ ...form, ngayBatDau: e.target.value })} />
        </div>
        <div className="catalog-field">
          <label htmlFor={`${prefix}-end`}>Kết thúc * <InfoHint label="Giải thích thời gian">Giờ Việt Nam, nhập dạng ngày/tháng/năm giờ:phút. Sau thời điểm kết thúc, chương trình hiển thị “Đã kết thúc”.</InfoHint></label>
          <input id={`${prefix}-end`} className="catalog-input" type="text" inputMode="numeric" placeholder="dd/mm/yyyy hh:mm" value={form.ngayKetThuc} onChange={(e) => setForm({ ...form, ngayKetThuc: e.target.value })} />
        </div>
      </div>
      <div className="catalog-field">
        <label htmlFor={`${prefix}-condition`}>Điều kiện áp dụng</label>
        <input id={`${prefix}-condition`} className="catalog-input" value={form.dieuKienApDung} onChange={(e) => setForm({ ...form, dieuKienApDung: e.target.value })} placeholder="Ví dụ: đơn từ 2 sản phẩm" />
      </div>
      <div className="catalog-field">
        <label htmlFor={`${prefix}-products`}>Mã sản phẩm áp dụng <InfoHint label="Giải thích phạm vi">Danh sách mã sản phẩm (số), cách nhau bởi dấu phẩy. Để trống nghĩa là áp dụng cho tất cả sản phẩm.</InfoHint></label>
        <input id={`${prefix}-products`} className="catalog-input" value={form.maSpApDung} onChange={(e) => setForm({ ...form, maSpApDung: e.target.value })} placeholder="Ví dụ: 101, 102 — để trống là mọi sản phẩm" />
      </div>
    </>
  );
}

/** Limit-aware usage: blue used, violet held, thin bar when a limit exists. */
function Usage({ code }: { code: PromotionCode }) {
  const limit = code.soLuongPhatHanh;
  if (limit === null) return <span className="meta">Không giới hạn</span>;
  const usedPct = Math.min(100, (code.daSuDung / limit) * 100);
  const heldPct = Math.min(100 - usedPct, (code.soLuongGiuCho / limit) * 100);
  return (
    <span className="l3-usage" role="img" aria-label={`Đã dùng ${code.daSuDung}, đang giữ ${code.soLuongGiuCho} trên ${limit}`}>
      <span className="l3-usage-bar"><span className="l3-usage-used" style={{ width: `${usedPct}%` }} /><span className="l3-usage-held" style={{ width: `${heldPct}%` }} /></span>
      <span className="l3-usage-text">{formatNumber(code.daSuDung + code.soLuongGiuCho)}/{formatNumber(limit)}</span>
    </span>
  );
}

export default function CampaignsPage() {
  const toast = useToast(); const can = useAdminCan(); const canManagePromo = can("PROMOTION_MANAGE");
  const [loai, setLoai] = useState("");
  const [trangThai, setTrangThai] = useState("");
  const [page, setPage] = useState(0);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [list, setList] = useState<ListState>({ kind: "loading" });
  const [openId, setOpenId] = useState<number | null>(null);
  const [detail, setDetail] = useState<Campaign | null>(null);
  const [detailError, setDetailError] = useState("");
  const [tab, setTab] = useState<"info" | "codes">("info");
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<FormValues>(EMPTY_FORM);
  const [formIssue, setFormIssue] = useState("");
  const [issue, setIssue] = useState("");
  const [codeForm, setCodeForm] = useState({ maCode: "", soLuong: "" });
  const [createdCode, setCreatedCode] = useState("");
  const [createdNotice, setCreatedNotice] = useState<{ maKm: number; ten: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [editBusy, setEditBusy] = useState(false);
  const [now, setNow] = useState(() => clockNow());
  const errorRef = useRef<HTMLDivElement>(null);
  const searchTimer = useRef<number | null>(null);
  // Request guards: only the newest list response, and only the detail of the campaign currently open, may land.
  const listSeq = useRef(0);
  const detailSeq = useRef(0);
  const size = 10;

  const load = useCallback(async () => {
    const seq = ++listSeq.current;
    setList({ kind: "loading" });
    try {
      const qs = new URLSearchParams({ page: String(page), size: String(size) });
      if (loai) qs.set("loai", loai);
      if (trangThai) qs.set("hieuLuc", trangThai);
      if (search) qs.set("q", search);
      const pg = await fetchCampaigns(qs.toString());
      if (seq !== listSeq.current) return;
      setList({ kind: "ready", rows: pg.data, total: pg.totalElements });
      setNow(clockNow());
    } catch (e) {
      if (seq !== listSeq.current) return;
      const st = (e as { status?: number })?.status ?? 0;
      setList({ kind: "error", message: benefitErrorMessage(st, null, e instanceof Error ? e.message : "Không tải được chương trình."), status: st });
      setTimeout(() => errorRef.current?.focus(), 0);
    }
  }, [loai, trangThai, page, search]);

  useEffect(() => {
    void Promise.resolve().then(() => load());
  }, [load]);

  function onSearchType(value: string) {
    setSearchInput(value);
    if (searchTimer.current) window.clearTimeout(searchTimer.current);
    searchTimer.current = window.setTimeout(() => { setPage(0); setSearch(value.trim()); }, 350);
  }
  function resetFilters() {
    if (searchTimer.current) window.clearTimeout(searchTimer.current);
    setSearchInput(""); setSearch(""); setLoai(""); setTrangThai(""); setPage(0);
  }
  const filtersActive = Boolean(searchInput || loai || trangThai);

  async function open(id: number, nextTab: "info" | "codes" = "info") {
    if (createdNotice && id !== createdNotice.maKm) setCreatedNotice(null);
    const seq = ++detailSeq.current;
    setOpenId(id);
    setTab(nextTab);
    setDetail(null);
    setDetailError("");
    setIssue("");
    try {
      const fetched = await fetchCampaign(id);
      if (seq !== detailSeq.current) return;
      setDetail(fetched);
      setNow(clockNow());
    } catch (e) {
      if (seq !== detailSeq.current) return;
      const st = (e as { status?: number })?.status ?? 0;
      setDetailError(benefitErrorMessage(st, null, "Không tải được chi tiết."));
    }
  }
  async function reloadDetail(id: number) {
    const seq = detailSeq.current;
    try {
      const fetched = await fetchCampaign(id);
      if (seq !== detailSeq.current) return;
      setDetail(fetched);
      setNow(clockNow());
    } catch (e) {
      if (seq !== detailSeq.current) return;
      const st = (e as { status?: number })?.status ?? 0;
      setIssue(benefitErrorMessage(st, null, "Không tải được chi tiết."));
    }
  }
  function closeDetail() {
    if (busy || editBusy) return;
    detailSeq.current++;
    setOpenId(null); setDetail(null); setCreatedCode(""); setIssue(""); setDetailError("");
  }

  async function submitCreate() {
    const tenCtkm = form.tenCtkm.trim();
    if (!tenCtkm) {
      setFormIssue("Nhập tên chương trình.");
      return;
    }
    const giaTriGiam = form.loaiGiam === "FREE_SHIP" ? 1 : Number(form.giaTriGiam);
    if (!Number.isFinite(giaTriGiam) || giaTriGiam <= 0) {
      setFormIssue("Giá trị giảm phải là số dương.");
      return;
    }
    if (form.loaiGiam === "PHAN_TRAM" && giaTriGiam > 100) {
      setFormIssue("Giảm theo % không vượt quá 100.");
      return;
    }
    if (!form.ngayBatDau || !form.ngayKetThuc || !Number.isFinite(inputTime(form.ngayBatDau)) || !Number.isFinite(inputTime(form.ngayKetThuc)) || inputTime(form.ngayBatDau) >= inputTime(form.ngayKetThuc)) {
      setFormIssue("Ngày bắt đầu phải trước ngày kết thúc.");
      return;
    }
    const maSpApDung = parseSpIds(form.maSpApDung);
    if (form.maSpApDung.trim() && maSpApDung === undefined) {
      setFormIssue("Mã sản phẩm áp dụng: danh sách số, cách nhau bởi dấu phẩy (để trống = tất cả).");
      return;
    }
    setFormIssue("");
    setBusy(true);
    try {
      const created = await createCampaign({
        tenCtkm, loaiGiam: form.loaiGiam as Campaign["loaiGiam"], giaTriGiam,
        ngayBatDau: inputToWire(form.ngayBatDau) ?? form.ngayBatDau,
        ngayKetThuc: inputToWire(form.ngayKetThuc) ?? form.ngayKetThuc,
        ...(form.dieuKienApDung.trim() ? { dieuKienApDung: form.dieuKienApDung.trim() } : {}),
        ...(maSpApDung !== undefined ? { maSpApDung } : {}),
      });
      detailSeq.current++;
      setCreating(false);
      setForm(EMPTY_FORM);
      setCreatedNotice({ maKm: created.maKm, ten: created.tenCtkm });
      setOpenId(created.maKm);
      setTab("info");
      setDetailError("");
      setIssue("");
      setDetail(created);
      toast.success(`Đã tạo chương trình “${created.tenCtkm}”.`);
      load();
    } catch (e) {
      const st = (e as { status?: number })?.status ?? 0;
      setFormIssue(benefitErrorMessage(st, null, e instanceof Error ? e.message : "Tạo thất bại."));
    } finally {
      setBusy(false);
    }
  }

  async function activateCreated() {
    if (!detail || !createdNotice || busy) return;
    if (detail.maKm !== createdNotice.maKm) return;
    if (detail.trangThai !== "TAM_DUNG") {
      setCreatedNotice(null);
      return;
    }
    const seq = detailSeq.current;
    setBusy(true);
    setIssue("");
    try {
      const updated = await updateCampaign(detail.maKm, { phienBan: detail.phienBan, trangThai: "HOAT_DONG" });
      if (seq === detailSeq.current) setDetail(updated);
      setCreatedNotice(null);
      toast.success("Chương trình đã chạy.");
      load();
    } catch (e) {
      const st = (e as { status?: number })?.status ?? 0;
      setIssue(st === 409
        ? "Chương trình đã thay đổi ở phiên khác. Tải lại chi tiết rồi làm tiếp."
        : benefitErrorMessage(st, null, e instanceof Error ? e.message : "Đổi trạng thái thất bại."));
    } finally {
      setBusy(false);
    }
  }

  async function togglePause() {
    if (!detail || busy) return;
    const next: "HOAT_DONG" | "TAM_DUNG" = detail.trangThai === "TAM_DUNG" ? "HOAT_DONG" : "TAM_DUNG";
    const seq = detailSeq.current;
    setCreatedNotice(null);
    setBusy(true);
    setIssue("");
    try {
      const updated = await updateCampaign(detail.maKm, { phienBan: detail.phienBan, trangThai: next });
      if (seq === detailSeq.current) setDetail(updated);
      toast.success(next === "TAM_DUNG" ? "Đã tạm dừng chương trình." : "Chương trình chạy lại.");
      load();
    } catch (e) {
      const st = (e as { status?: number })?.status ?? 0;
      const message = st === 409
        ? "Chương trình đã thay đổi ở phiên khác. Tải lại chi tiết rồi làm tiếp."
        : benefitErrorMessage(st, null, e instanceof Error ? e.message : "Đổi trạng thái thất bại.");
      setIssue(message);
      toast.error(message);
    } finally {
      setBusy(false);
    }
  }

  async function submitCode() {
    if (!detail || busy) return;
    const maCode = codeForm.maCode.trim().toUpperCase();
    if (!maCode) {
      setIssue("Nhập Voucher.");
      return;
    }
    const soLuong = codeForm.soLuong.trim() ? Number(codeForm.soLuong) : null;
    if (soLuong !== null && (!Number.isInteger(soLuong) || soLuong <= 0)) {
      setIssue("Số lượng phát hành phải là số nguyên > 0 (để trống = không giới hạn).");
      return;
    }
    setBusy(true);
    setIssue("");
    try {
      const created = await addCampaignCode(detail.maKm, { maCode, soLuongPhatHanh: soLuong });
      setCreatedCode(`${created.maCode} (đã dùng ${created.daSuDung} · đang giữ ${created.soLuongGiuCho} / ${created.soLuongPhatHanh ?? "∞"})`);
      toast.success(`Đã phát hành Voucher ${created.maCode}.`);
      void reloadDetail(detail.maKm);
      setCodeForm({ maCode: "", soLuong: "" });
      load();
    } catch (e) {
      const st = (e as { status?: number })?.status ?? 0;
      setIssue(benefitErrorMessage(st, null, e instanceof Error ? e.message : "Thêm Voucher thất bại."));
    } finally {
      setBusy(false);
    }
  }

  const detailStatus = detail ? effectiveStatus(detail, now) : null;
  const rows = list.kind === "ready" ? list.rows : [];
  return (
    <AdminShellB active="promotions" title="Khuyến mãi">
      <PageHeader
        title="Khuyến mãi"
        hint="Sửa hoặc tạm dừng tạo phiên bản mới; đơn đã chốt giữ nguyên ưu đãi và phiên bản cũ. Chương trình mới mặc định tạm dừng để kiểm tra trước khi mở."
        actions={canManagePromo ? <button className="primary" type="button" onClick={() => { setFormIssue(""); setCreating(true); }}>Tạo chương trình</button> : null}
      />

      <div className="orders-filters l3-filters" role="search">
        <div className="catalog-field live-search-field"><label htmlFor="km-q">Tìm chương trình</label><div className="live-search-control"><input id="km-q" type="search" className="catalog-input" value={searchInput} onChange={(e) => onSearchType(e.target.value)} maxLength={100} placeholder="Tìm tên chương trình" />{searchInput ? <button className="live-search-clear" type="button" onClick={() => onSearchType("")} aria-label="Xóa từ khóa">Xóa</button> : null}</div></div>
        <div className="catalog-field l3-select"><label htmlFor="km-loai">Loại giảm</label>
          <select id="km-loai" className="catalog-input" value={loai} onChange={(e) => { setLoai(e.target.value); setPage(0); }}>
            <option value="">Mọi loại</option>
            <option value="PHAN_TRAM">% theo đơn</option>
            <option value="SO_TIEN">Tiền cố định</option>
            <option value="FREE_SHIP">Miễn phí giao hàng</option>
          </select>
        </div>
        <div className="catalog-field l3-select"><label htmlFor="km-status">Trạng thái</label>
          <select id="km-status" className="catalog-input" value={trangThai} onChange={(e) => { setTrangThai(e.target.value); setPage(0); }}>
            <option value="">Mọi trạng thái</option>
            <option value="DANG_CHAY">Đang chạy</option>
            <option value="TAM_DUNG">Tạm dừng</option>
            <option value="DA_KET_THUC">Đã kết thúc</option>
            <option value="CHUA_BAT_DAU">Chưa bắt đầu</option>
          </select>
        </div>
        {filtersActive ? <button className="secondary" type="button" onClick={resetFilters}>Đặt lại</button> : null}
      </div>

      <section aria-label="Danh sách chương trình">
        {list.kind === "loading" ? <TableSkeleton rows={8} columns={6} /> : null}
        {list.kind === "error" ? (
          <div ref={errorRef} tabIndex={-1} className="order-empty" role="alert">
            <strong>Không tải được chương trình</strong>
            <p>{list.message}</p>
            <button className="secondary" type="button" onClick={load}>Thử lại</button>
          </div>
        ) : null}
        {list.kind === "ready" ? (
          rows.length === 0 ? <div className="order-empty"><strong>Chưa có chương trình nào với bộ lọc hiện tại</strong><p>Thử bỏ bộ lọc hoặc tạo chương trình mới.</p></div> : (
            <div className="table-scroll sticky-head review-table-scroll table-cards" tabIndex={0} aria-label="Danh sách chương trình">
              <table className="review-orders-table l3-table">
                <caption className="sr-only">Danh sách chương trình</caption>
                <thead><tr><th>Tên chương trình</th><th className="num">Mức giảm</th><th>Bắt đầu</th><th>Kết thúc</th><th>Trạng thái</th></tr></thead>
                <tbody>
                  {rows.map((c) => {
                    const status = effectiveStatus(c, now);
                    return (
                      <tr key={c.maKm} className="row-link" onClick={(event) => { if ((event.target as HTMLElement).closest("button,a,input,select")) return; void open(c.maKm); }}>
                        <td data-label="" className="cell-title"><button className="l3-rowbtn" type="button" onClick={() => void open(c.maKm)}>{c.tenCtkm}</button><small className="l3-id">#{c.maKm}</small></td>
                        <td data-label="Mức giảm" className="num"><strong className="t-violet">{discountLabel(c)}</strong></td>
                        <td data-label="Bắt đầu" className="cell-date">{fmtDateTime(c.ngayBatDau)}</td>
                        <td data-label="Kết thúc" className="cell-date">{fmtDateTime(c.ngayKetThuc)}</td>
                        <td data-label="Trạng thái"><StatusBadge status="CAMPAIGN" tone={status.tone} label={status.label} />{status.storedDiffers ? <small className="l3-id">Lưu: {stateLabel(c.trangThai)}</small> : null}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )
        ) : null}
        {list.kind === "ready" && rows.length > 0 ? (
          <Pager page={page} totalPages={Math.ceil(list.total / size)} total={list.total} unit="chương trình" onPage={setPage} />
        ) : null}
      </section>

      <AdminModal
        open={creating}
        title="Tạo chương trình"
        size="md"
        busy={busy}
        onClose={() => { if (!busy) setCreating(false); }}
        footer={<><button className="secondary" type="button" disabled={busy} onClick={() => setCreating(false)}>Hủy</button><button className="primary" type="submit" form="ct-create-form" disabled={busy}>{busy ? "Đang tạo…" : "Tạo chương trình"}</button></>}
      >
        <form id="ct-create-form" className="catalog-form" noValidate onSubmit={(e) => { e.preventDefault(); void submitCreate(); }}>
          <CampaignFields prefix="ct" form={form} setForm={setForm} />
          {formIssue ? <p className="catalog-error" role="alert">{formIssue}</p> : null}
        </form>
      </AdminModal>

      <AdminModal
        open={openId !== null}
        title={detail ? detail.tenCtkm : `Chương trình #${openId ?? ""}`}
        size="lg"
        busy={busy || editBusy}
        onClose={closeDetail}
        headerActions={detail && canManagePromo ? <button className="secondary btn-sm" type="button" disabled={busy} onClick={togglePause}>{detail.trangThai === "TAM_DUNG" ? "Mở lại" : "Tạm dừng"}</button> : null}
        footer={<>
          <button className="secondary" type="button" disabled={busy || editBusy} onClick={closeDetail}>Đóng</button>
          {detail && tab === "info" && canManagePromo ? <button className="primary" type="submit" form="ct-edit-form" disabled={busy || editBusy}>{editBusy ? "Đang lưu…" : "Lưu phiên bản mới"}</button> : null}
        </>}
      >
        {detailError ? <div className="order-empty" role="alert"><strong>Không tải được chi tiết</strong><p>{detailError}</p>{openId !== null ? <button className="secondary" type="button" onClick={() => void open(openId, tab)}>Thử lại</button> : null}</div> : null}
        {!detail && !detailError ? <TableSkeleton rows={5} columns={2} /> : null}
        {detail && detailStatus ? <>
          <div className="l3-detail-strip">
            <StatusBadge status="CAMPAIGN" tone={detailStatus.tone} label={detailStatus.label} />
            <span className="l3-detail-meta">Mức giảm <strong className="t-violet">{discountLabel(detail)}</strong></span>
            <span className="l3-detail-meta">Phiên bản <strong>{detail.phienBan}</strong></span>
            <span className="l3-detail-meta">Voucher đã phát hành <strong className="t-blue">{detail.codes.length}</strong></span>
          </div>
          {createdNotice && createdNotice.maKm === detail.maKm ? (
            <div className="catalog-warning l3-notice" role="status">
              <span>Đã tạo chương trình, đang <strong>tạm dừng</strong>: Voucher sẽ báo lỗi khi khách áp dụng cho tới khi bật.</span>
              <span className="l3-notice-actions">
                <button className="secondary btn-sm" type="button" disabled={busy} onClick={activateCreated}>{busy ? "Đang bật…" : "Bật ngay"}</button>
                <button className="text-link" type="button" onClick={() => setCreatedNotice(null)}>Để sau</button>
              </span>
            </div>
          ) : detail.trangThai === "TAM_DUNG" ? (
            <div className="catalog-warning l3-notice" role="status">Chương trình đang tạm dừng: Voucher sẽ báo lỗi khi khách áp dụng. Bấm “Mở lại” trước khi giao Voucher cho khách.</div>
          ) : null}
          <div className="l3-tabs" role="tablist" aria-label="Chi tiết chương trình">
            <button type="button" role="tab" id="ct-tab-info" aria-selected={tab === "info"} aria-controls="ct-panel" onClick={() => setTab("info")}>Thông tin</button>
            <button type="button" role="tab" id="ct-tab-codes" aria-selected={tab === "codes"} aria-controls="ct-panel" onClick={() => setTab("codes")}>Voucher <span className="l3-tab-count">{detail.codes.length}</span></button>
          </div>
          <div id="ct-panel" role="tabpanel" aria-labelledby={`ct-tab-${tab}`} className="l3-panel">
            {/* The edit form stays mounted while the codes tab is shown, so unsaved edits survive a tab switch. */}
            <div hidden={tab !== "info"}>
              <EditCampaignForm key={`${detail.maKm}:${detail.phienBan}`} campaign={detail} formId="ct-edit-form" onBusyChange={setEditBusy} onSaved={(c) => { setDetail(c); toast.success("Đã lưu phiên bản mới."); load(); }} />
            </div>
            {tab === "codes" ? (
              <>
                {canManagePromo ? <form className="l3-code-row" noValidate onSubmit={(e) => { e.preventDefault(); void submitCode(); }}>
                  <div className="catalog-field">
                    <label htmlFor="ct-code">Voucher mới <InfoHint label="Giải thích phát hành Voucher">Voucher được chuyển thành chữ in hoa; để trống số lượng nghĩa là không giới hạn.</InfoHint></label>
                    <input id="ct-code" className="catalog-input" value={codeForm.maCode} onChange={(e) => setCodeForm({ ...codeForm, maCode: e.target.value })} maxLength={50} placeholder="Ví dụ: SALE10" style={{ textTransform: "uppercase" }} />
                  </div>
                  <div className="catalog-field">
                    <label htmlFor="ct-quota">Số lượng phát hành</label>
                    <input id="ct-quota" className="catalog-input" value={codeForm.soLuong} onChange={(e) => setCodeForm({ ...codeForm, soLuong: e.target.value })} placeholder="Để trống = không giới hạn" inputMode="numeric" />
                  </div>
                  <button className="primary" type="submit" disabled={busy}>{busy ? "Đang phát hành…" : "Phát hành Voucher"}</button>
                </form> : null}
                {createdCode ? <p className="meta" role="status">Đã phát hành: <strong>{createdCode}</strong></p> : null}
                {detail.codes.length === 0 ? <div className="order-empty"><strong>Chưa phát hành Voucher cho chương trình này</strong><p>Nhập Voucher ở trên để tạo Voucher đầu tiên.</p></div> : (
                  <div className="table-scroll sticky-head table-cards" tabIndex={0} aria-label="Voucher đã phát hành">
                    <table className="review-orders-table l3-table">
                      <caption className="sr-only">Voucher đã phát hành; lượt dùng và lượt giữ được cập nhật tự động.</caption>
                      <thead><tr><th>Voucher</th><th>Trạng thái</th><th className="num">Đã dùng</th><th className="num">Đang giữ</th><th>Phát hành</th></tr></thead>
                      <tbody>
                        {detail.codes.map((code) => (
                          <tr key={code.maVoucher}>
                            <td data-label="Voucher" className="cell-title"><code className="l3-code">{code.maCode}</code></td>
                            <td data-label="Trạng thái"><StatusBadge status="CODE" tone={code.trangThai === "ACTIVE" ? "green" : "amber"} label={codeStatusLabel(code.trangThai)} /></td>
                            <td data-label="Đã dùng" className="num"><span className={code.daSuDung > 0 ? "t-blue" : "t-gray"}>{formatNumber(code.daSuDung)}</span></td>
                            <td data-label="Đang giữ" className="num"><span className={code.soLuongGiuCho > 0 ? "t-violet" : "t-gray"}>{formatNumber(code.soLuongGiuCho)}</span></td>
                            <td data-label="Phát hành"><Usage code={code} /></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                <div className="l3-reload"><button className="text-link" type="button" disabled={busy} onClick={() => void reloadDetail(detail.maKm)}>Tải lại số liệu</button></div>
              </>
            ) : null}
            {issue ? <p className="catalog-error" role="alert">{issue}</p> : null}
          </div>
        </> : null}
      </AdminModal>
    </AdminShellB>
  );
}

function EditCampaignForm({ campaign, formId, onBusyChange, onSaved }: { campaign: Campaign; formId: string; onBusyChange: (busy: boolean) => void; onSaved: (c: Campaign) => void }) {
  const [form, setForm] = useState<FormValues>({ tenCtkm: campaign.tenCtkm, loaiGiam: campaign.loaiGiam, giaTriGiam: String(campaign.giaTriGiam), ngayBatDau: fmtDateTime(campaign.ngayBatDau), ngayKetThuc: fmtDateTime(campaign.ngayKetThuc), dieuKienApDung: campaign.dieuKienApDung ?? "", maSpApDung: campaign.maSpApDung.join(", ") });
  const [issue, setIssue] = useState("");
  const [busy, setBusy] = useState(false);
  async function save() {
    if (busy) return;
    const tenCtkm = form.tenCtkm.trim();
    const giaTriGiam = form.loaiGiam === "FREE_SHIP" ? 1 : Number(form.giaTriGiam);
    const maSpApDung = parseSpIds(form.maSpApDung);
    if (!tenCtkm || !Number.isFinite(giaTriGiam) || giaTriGiam <= 0 || (form.loaiGiam === "PHAN_TRAM" && giaTriGiam > 100) || !form.ngayBatDau || !form.ngayKetThuc || !Number.isFinite(inputTime(form.ngayBatDau)) || !Number.isFinite(inputTime(form.ngayKetThuc)) || inputTime(form.ngayBatDau) >= inputTime(form.ngayKetThuc) || maSpApDung === undefined) {
      setIssue("Kiểm tra tên, mức giảm, khoảng thời gian và danh sách sản phẩm.");
      return;
    }
    setBusy(true); onBusyChange(true); setIssue("");
    try {
      onSaved(await updateCampaign(campaign.maKm, { phienBan: campaign.phienBan, tenCtkm, loaiGiam: form.loaiGiam as Campaign["loaiGiam"], giaTriGiam, ngayBatDau: inputToWire(form.ngayBatDau) ?? form.ngayBatDau, ngayKetThuc: inputToWire(form.ngayKetThuc) ?? form.ngayKetThuc, dieuKienApDung: form.dieuKienApDung, maSpApDung }));
    } catch (e) {
      const st = (e as { status?: number })?.status ?? 0;
      setIssue(st === 409 ? "Chương trình đã thay đổi ở phiên khác. Tải lại chi tiết rồi sửa tiếp." : benefitErrorMessage(st, null, e instanceof Error ? e.message : "Lưu thất bại."));
    } finally { setBusy(false); onBusyChange(false); }
  }
  return (
    <form id={formId} className="catalog-form" aria-label="Sửa chương trình" noValidate onSubmit={(e) => { e.preventDefault(); void save(); }}>
      <p className="l3-form-note">Lưu thành phiên bản mới <InfoHint label="Giải thích phiên bản">Lưu thành phiên bản mới; phiên bản đang dùng cho đơn đã chốt không đổi.</InfoHint></p>
      <CampaignFields prefix="ct-edit" form={form} setForm={setForm} />
      {issue ? <p className="catalog-error" role="alert">{issue}</p> : null}
    </form>
  );
}
