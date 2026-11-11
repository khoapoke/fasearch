"use client";

import { useEffect, useState } from "react";
import { AdminShellB } from "@/components/admin-b/admin-shell";
import { useAdminCan } from "@/components/admin-b/use-admin-role";
import { PageHeader } from "@/components/admin-b/page-header";
import { TableSkeleton } from "@/components/admin-b/skeleton";
import { AdminModal } from "@/components/admin-b/modal";
import { Num, StatusBadge } from "@/components/admin-b/status-badge";
import { Pager } from "@/components/admin-b/pagination";
import { useToast } from "@/components/admin-b/toast";
import { formatDateTime } from "@/lib/admin-format";
import { roleLabel } from "@/lib/admin-people-client";
import { auditObjects, auditActions, auditQuery, auditRead, type AuditEntry, type AuditPage, type AuditFilters } from "@/lib/admin-audit";
import "@/components/admin-b/r3-fix.css";

const emptyFilters: AuditFilters = { from: "", to: "", actor: "", objectType: "", action: "", q: "" };
const fieldNames: Record<string, string> = {
  ten_sp: "Tên sản phẩm", gia_ban: "Giá bán", trang_thai: "Trạng thái", status: "Trạng thái", da_xoa: "Đã xóa",
  ten_kh: "Tên khách hàng", ho_kh: "Họ khách hàng", ten_nv: "Tên nhân sự", ho_nv: "Họ nhân sự", ten_dang_nhap: "Tên đăng nhập",
  ma_vai_tro: "Mã vai trò", ma_quyen: "Quyền", tong_tien: "Tổng tiền", tong_tien_thuc_tra: "Thực trả", ma_don: "Mã đơn",
  refund_amount: "Tiền hoàn", points: "Số điểm", entry_type: "Loại giao dịch", credential_changed: "Đổi mật khẩu",
  email_changed: "Đổi email", sdt_changed: "Đổi điện thoại", dia_chi_changed: "Đổi địa chỉ", cccd_changed: "Đổi giấy tờ",
  ngay_sinh_changed: "Đổi ngày sinh", gioi_tinh_changed: "Đổi giới tính", mo_ta_changed: "Đổi mô tả",
  so_luong_vat_ly: "Tồn thực tế", so_luong_kha_dung: "Tồn khả dụng", so_luong_tam_giu: "Tạm giữ", ma_phieu: "Mã phiếu",
  ten_danh_muc: "Tên danh mục", ten_ctkm: "Tên chương trình", ma_code: "Mã Voucher", diem_tich_luy: "Điểm tích lũy",
  current_version: "Phiên bản hiện tại", earn_currency_per_point: "Số tiền để nhận 1 điểm", redeem_currency_per_point: "Giá trị đổi 1 điểm",
  ma_danh_muc: "Mã danh mục", publication_status: "Trạng thái Publish", publication_version: "Phiên bản Publish",
  chat_lieu: "Chất liệu", kieu_dang: "Kiểu dáng", ma_sp: "Mã sản phẩm", mau_sac: "Màu sắc", kich_co: "Kích cỡ", ma_vach: "Barcode",
  ma_nv: "Mã nhân sự", phi_van_chuyen: "Phí giao hàng", tien_giam: "Giảm Voucher", redeemed_points: "Điểm sử dụng", points_discount: "Giảm từ điểm",
  ma_don_hang: "Mã đơn hàng", ma_hoa_don: "Mã hóa đơn", ma_phuong_thuc_tt: "Mã phương thức thanh toán", so_tien: "Số tiền",
  order_id: "Mã đơn hàng", reason: "Lý do", merchandise_amount: "Tiền hàng", shipping_amount: "Phí giao hàng hoàn lại",
  earned_reverse: "Điểm thu hồi", redeemed_return: "Điểm hoàn lại", points_shortfall: "Điểm còn thiếu", sku_id: "Mã SKU",
  quantity: "Số lượng", restock_quantity: "Nhập lại kho", tong_so_luong: "Tổng số lượng", loai_xuat: "Loại xuất kho",
  tong_so_lech: "Tổng chênh lệch", nguong_toi_thieu: "Ngưỡng cảnh báo", ma_sku: "Mã SKU", so_luong: "Số lượng",
  gia_nhap: "Giá nhập", thanh_tien: "Thành tiền", so_luong_he_thong: "Số lượng hệ thống", so_luong_thuc_te: "Số lượng thực tế",
  chenh_lech: "Chênh lệch", loai_giam: "Loại giảm", gia_tri_giam: "Giá trị giảm", ngay_bat_dau: "Bắt đầu", ngay_ket_thuc: "Kết thúc",
  phien_ban: "Phiên bản", dieu_kien_ap_dung_changed: "Đổi điều kiện áp dụng", ma_km: "Mã chương trình", so_luong_phat_hanh: "Số lượng phát hành",
  da_su_dung: "Đã sử dụng", so_luong_giu_cho: "Giữ chỗ", version: "Phiên bản", customer_id: "Mã khách hàng", ma_hang: "Mã hạng",
  diem_giu_cho: "Điểm giữ chỗ", ma_tk: "Mã tài khoản", ten_hang: "Tên hạng", nguong_diem: "Ngưỡng điểm", nguong_doanh_so: "Ngưỡng doanh số",
  phien_ban_doanh_so: "Phiên bản doanh số", quyen_loi_changed: "Đổi quyền lợi", hinh_anh_kh_changed: "Đổi ảnh khách hàng",
  hinh_anh_nv_changed: "Đổi ảnh nhân sự", hinh_anh_sp_changed: "Đổi ảnh sản phẩm", delivery_latitude_changed: "Đổi vị trí giao hàng",
  delivery_longitude_changed: "Đổi vị trí giao hàng", cancellation_reason_changed: "Đổi lý do hủy",
};
const valueLabels: Record<string, string> = { PENDING: "Chờ xác nhận", CONFIRMED: "Đã xác nhận", PACKING: "Đang đóng gói", SHIPPING: "Đang giao", COMPLETED: "Hoàn tất", CANCELLED: "Đã hủy", RETURNED: "Đã trả hàng", ACTIVE: "Hoạt động", INACTIVE: "Ngừng hoạt động", LOCKED: "Đã khóa", DELETED: "Đã xóa", PAID: "Đã thanh toán", UNPAID: "Chưa thanh toán", REFUNDED: "Đã hoàn tiền", ENABLED: "Bật", DISABLED: "Tắt", APPROVED: "Đã duyệt", REJECTED: "Từ chối", RECEIVED: "Đã nhận hàng", HOAT_DONG: "Hoạt động", TAM_DUNG: "Tạm dừng", PENDING_APPROVAL: "Chờ duyệt", PUBLISHED: "Publish", UNPUBLISHED: "Unpublish", DRAFT: "Draft", OUT_OF_STOCK: "Hết hàng", DISCONTINUED: "Ngừng bán", DAMAGED: "Hàng lỗi", PHAN_TRAM: "Phần trăm", SO_TIEN: "Số tiền", FREE_SHIP: "Miễn phí giao hàng", WRONG_SIZE: "Sai kích cỡ", DEFECTIVE: "Lỗi sản phẩm", NOT_AS_DESCRIBED: "Không giống mô tả", CHANGE_MIND: "Đổi ý", OTHER: "Khác", ADJUST: "Điều chỉnh", EARN: "Tích điểm", REDEEM: "Sử dụng điểm", HOLD: "Giữ điểm", RELEASE: "Trả điểm giữ chỗ", OPENING: "Số dư đầu kỳ", RETURN_REVERSE: "Thu hồi điểm trả hàng", RETURN_REDEEM: "Hoàn điểm đã dùng" };
const moneyFields = new Set(["gia_ban", "tong_tien", "tong_tien_thuc_tra", "refund_amount", "phi_van_chuyen", "tien_giam", "points_discount", "so_tien", "merchandise_amount", "shipping_amount", "gia_nhap", "thanh_tien", "earn_currency_per_point", "redeem_currency_per_point", "nguong_doanh_so"]);
function AuditValue({ field, value }: { field: string; value: unknown }) {
  if (value === null || value === undefined) return <>—</>;
  if (typeof value === "boolean") return <>{value ? "Có" : "Không"}</>;
  if (typeof value === "number") return <Num value={value} money={moneyFields.has(field)} />;
  if (["status", "trang_thai", "publication_status"].includes(field)) return <StatusBadge status={String(value)} label={valueLabels[String(value)] || String(value)} />;
  return <>{valueLabels[String(value)] || String(value)}</>;
}

export default function AuditPageView() {
  const can = useAdminCan(); const toast = useToast();
  const [filters, setFilters] = useState(emptyFilters);
  const [page, setPage] = useState(0);
  const [state, setState] = useState<{ data: AuditPage | null; busy: boolean; error: string }>({ data: null, busy: true, error: "" });
  const [detail, setDetail] = useState<AuditEntry | null>(null);
  const [detailBusy, setDetailBusy] = useState(false);
  const [exportBusy, setExportBusy] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const query = auditQuery(filters); const allowed = can("AUDIT_VIEW");
  useEffect(() => {
    if (!allowed) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setState(prev => ({ ...prev, busy: true, error: "" }));
      auditRead<AuditPage>(`?${query}&page=${page}&size=20`, controller.signal)
        .then(data => { if (!controller.signal.aborted) setState({ data, busy: false, error: "" }); })
        .catch(error => { if (!controller.signal.aborted) setState({ data: null, busy: false, error: error instanceof Error ? error.message : "Không tải được nhật ký." }); });
    }, 250);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [query, page, allowed, refresh]);
  const change = (key: keyof AuditFilters, value: string) => { setFilters(prev => ({ ...prev, [key]: value })); setPage(0); };
  const openDetail = async (entry: AuditEntry) => {
    setDetail(entry); setDetailBusy(true);
    try { setDetail(await auditRead<AuditEntry>(`/${entry.id}`)); }
    catch (error) { toast.error(error instanceof Error ? error.message : "Không tải được chi tiết."); setDetail(null); }
    finally { setDetailBusy(false); }
  };
  const exportCsv = async () => {
    setExportBusy(true);
    try {
      const response = await fetch(`/api/admin/audit/export?${query}`, { cache: "no-store" });
      if (!response.ok) { const payload = await response.json(); throw new Error(payload.message || "Không Export CSV được."); }
      const url = URL.createObjectURL(await response.blob()); const link = document.createElement("a");
      link.href = url; link.download = "activity-log.csv"; link.click(); window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast.success("Đã Export CSV nhật ký hoạt động.");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Không Export CSV được."); }
    finally { setExportBusy(false); }
  };
  return <AdminShellB active="audit" title="Nhật ký hoạt động"><div className="r3-audit">
    <PageHeader title="Nhật ký hoạt động" hint="Xem người thực hiện và thay đổi của từng nghiệp vụ. Bộ lọc ngày tính theo giờ Việt Nam." actions={<><button className="secondary" onClick={() => setRefresh(v => v + 1)} disabled={state.busy}>Làm mới</button>{can("DATA_EXPORT") && allowed ? <button className="primary" onClick={() => void exportCsv()} disabled={exportBusy || state.busy}>{exportBusy ? "Đang xuất…" : "Export CSV"}</button> : null}</>} />
    {!allowed ? <p role="alert">Bạn không có quyền xem nhật ký hoạt động.</p> : <>
      <div className="r3-audit-filters">
        <label>Tìm đối tượng<input type="search" placeholder="Tên hoặc mã đối tượng" maxLength={200} value={filters.q} onChange={e => change("q", e.target.value)} /></label>
        <label>Người thực hiện<input placeholder="Tài khoản hoặc mã tài khoản" maxLength={200} value={filters.actor} onChange={e => change("actor", e.target.value)} /></label>
        <label>Loại đối tượng<select value={filters.objectType} onChange={e => change("objectType", e.target.value)}><option value="">Tất cả đối tượng</option>{Object.entries(auditObjects).map(([key, label]) => <option value={key} key={key}>{label}</option>)}</select></label>
        <label>Hành động<select value={filters.action} onChange={e => change("action", e.target.value)}><option value="">Tất cả hành động</option>{Object.entries(auditActions).map(([key, label]) => <option value={key} key={key}>{label}</option>)}</select></label>
        <label>Từ ngày<input type="date" value={filters.from} onChange={e => change("from", e.target.value)} /></label>
        <label>Đến ngày<input type="date" value={filters.to} min={filters.from} onChange={e => change("to", e.target.value)} /></label>
        <button className="secondary" onClick={() => { setFilters(emptyFilters); setPage(0); }}>Xóa bộ lọc</button>
      </div>
      {state.error ? <p role="alert" className="r3-audit-error">{state.error}</p> : state.busy ? <TableSkeleton rows={6} columns={5} /> : <>
        <div className="r3-audit-table"><table><thead><tr><th>Thời gian</th><th>Người thực hiện</th><th>Hành động</th><th>Đối tượng</th><th>Chi tiết</th></tr></thead><tbody>
          {state.data?.content.map(entry => <tr key={entry.id}><td>{formatDateTime(entry.occurredAt)}</td><td><strong>{entry.actorUsername === "SYSTEM" ? "Hệ thống" : entry.actorUsername}</strong><small>{entry.actorRole === "SYSTEM" ? "Tự động" : roleLabel(entry.actorRole)}</small></td><td>{auditActions[entry.action] || entry.action}</td><td><strong>{entry.objectLabel}</strong><small>{auditObjects[entry.objectType] || entry.objectType} · #{entry.objectId}</small></td><td><button className="secondary" aria-label={`Xem hoạt động ${entry.id}`} onClick={() => void openDetail(entry)}>Xem thay đổi</button></td></tr>)}
        </tbody></table>{!state.data?.content.length ? <p className="r3-audit-empty">Không có hoạt động khớp bộ lọc.</p> : null}</div>
        {state.data ? <Pager page={page} totalPages={state.data.totalPages} total={state.data.totalElements} unit="hoạt động" onPage={setPage} /> : null}
      </>}
    </>}
    <AdminModal open={detail !== null} title="Chi tiết hoạt động" description={detail ? `${auditObjects[detail.objectType] || detail.objectType} · ${detail.objectLabel}` : undefined} size="lg" onClose={() => { if (!detailBusy) setDetail(null); }} busy={detailBusy}>
      {detail ? <><p>{formatDateTime(detail.occurredAt)} · {detail.actorUsername === "SYSTEM" ? "Hệ thống" : detail.actorUsername} · {auditActions[detail.action] || detail.action}</p>{detailBusy ? <p role="status">Đang tải chi tiết…</p> : <div className="r3-audit-diff"><table><thead><tr><th>Trường</th><th>Trước</th><th>Sau</th></tr></thead><tbody>{Object.entries(detail.changes).map(([field, values]) => <tr key={field}><th>{fieldNames[field] || field.replaceAll("_", " ")}</th><td><AuditValue field={field} value={values.before} /></td><td><AuditValue field={field} value={values.after} /></td></tr>)}</tbody></table></div>}</> : null}
    </AdminModal>
  </div></AdminShellB>;
}
