// Pure commerce helpers cho orders-pos-full-ai (frozen CONTRACT.md revision 1).
// Không fetch, không mock — chỉ types, keys, validation, labels, paging.
// BE giữ nguyên envelope ApiResponse { success, code, message, result, errors }.

export type CartItem = {
  maSku: number;
  maSp: number;
  tenSp: string;
  mauSac: string | null;
  kichCo: string | null;
  soLuong: number;
  donGia: number;
  tongDong: number;
  coTheMua: boolean;
  lyDoKhongTheMua: string | null;
  tienGiamGia?: number | null;
};

export type Cart = {
  maGioHang: number;
  phienBan: number;
  items: CartItem[];
  tongTienHang: number;
};

export type Quote = {
  phienBanGio: number;
  maKho: number;
  items: CartItem[];
  tongTienHang: number;
  giamGia: number;
  phiVanChuyen: number;
  tongThanhToan: number;
  coTheDat: boolean;
  canhBao: string[];
  // Ưu đãi (optional — quotes cũ không có vẫn render; server authoritative).
  voucherCode?: string | null;
  diemSuDung?: number | null;
  giamVoucher?: number | null;
  giamDiem?: number | null;
  diemDuocPhep?: number | null;
  maChinhSach?: number | null;
  phienBanChinhSach?: number | null;
  quoteId?: string | null;
};

export type Warehouse = { maKho: number; tenKho: string; laMacDinh: boolean };

export type OrderLine = {
  maSku: number;
  maSp: number;
  tenSpSnapshot: string;
  mauSacSnapshot: string | null;
  kichCoSnapshot: string | null;
  soLuong: number;
  donGia: number;
  tongDong: number;
  tienGiamGia?: number | null;
};

export type OrderHistory = { trangThai: string; thoiGian: string; nguoiThucHien?: string | null };

export type OrderDetail = {
  maDonHang: number;
  kenhBan: "ONLINE" | "POS";
  trangThai: string;
  phienBan: number;
  maKho: number;
  ngayDat: string;
  nguoiNhan?: string | null;
  sdtNhan?: string | null;
  diaChiGiao?: string | null;
  items: OrderLine[];
  tongTienHang: number;
  giamGia: number;
  phiVanChuyen: number;
  tongThanhToan: number;
  trangThaiThanhToan: "CHUA_THANH_TOAN" | "DA_THANH_TOAN";
  phuongThucThanhToan: "COD" | "TIEN_MAT";
  maHoaDon?: number | string | null;
  lichSu: OrderHistory[];
  hanhDongChoPhep: string[];
  // Snapshot frozen ưu đãi (optional — receipts cũ thiếu vẫn render, không bịa).
  maVoucher?: number | null;
  diemSuDung?: number | null;
  /** false = đơn legacy đã hủy, không còn bản ghi dùng voucher → không suy phân bổ. */
  phanBoGiamXacDinh?: boolean | null;
  giamVoucher?: number | null;
  giamDiem?: number | null;
};

export type PosDraft = {
  maDonHang: number;
  trangThai: string;
  maKh: number | null;
  customerName: string | null;
  customerPhone: string | null;
  items: Array<{ maSku: number; maSp?: number; tenSp?: string; soLuong: number; donGia?: number }>;
};

export type PosQuote = {
  orderId: number;
  items: Array<{ skuId: number; productName: string; quantity: number; unitPrice: number; totalPrice: number; discountAmount: number; pointsDiscountAmount: number }>;
  tongTienHang: number;
  giamGia: number;
  phiVanChuyen: number;
  tongThanhToan: number;
  voucherCode: string | null;
  diemSuDung: number;
  giamVoucher: number;
  giamDiem: number;
  diemDuocPhep: number;
  maChinhSach: number | null;
  phienBanChinhSach: number | null;
  availablePoints: number | null;
  allowedRedeemedPoints: number;
  policyStatus: "UNCONFIGURED" | "DISABLED" | "ENABLED";
  remainingMerchandiseAmount: number;
  redeemCurrencyPerPoint: number | null;
  quoteFingerprint: string;
  quoteId?: string | null;
};

export type PosReceipt = {
  maHoaDon: number | string;
  maDonHang: number;
  tongThanhToan: number;
  tienThua: number;
  giamGia: number;
  maVoucher: number | null;
  diemSuDung: number | null;
  giamVoucher: number | null;
  giamDiem: number | null;
  earnedPoints: number | null;
  loyaltyPolicyId: number | null;
  loyaltyPolicyVersion: number | null;
  redeemCurrencyPerPointSnapshot: number | null;
  phanBoGiamXacDinh: boolean;
  items: Array<{ maSku: number; tenSpSnapshot: string; soLuong: number; tongDong: number; tienGiamGia: number | null; diemGiam: number | null }>;
};

/** Operation key mới cho mỗi payload mới; retry/timeout giữ nguyên key. */
export function newOperationKey(): string {
  try {
    const c = globalThis.crypto as Crypto | undefined;
    if (c && typeof c.randomUUID === "function") return c.randomUUID();
  } catch {
    /* fallback */
  }
  return `op-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e9).toString(36)}`;
}

const ONLINE_SEQ = ["MOI_TAO", "DA_XAC_NHAN", "DANG_DONG_GOI", "DA_GIAO_VAN_CHUYEN", "HOAN_THANH"];

export function orderStatusLabel(status: string): string {
  switch (status) {
    case "MOI_TAO": return "Mới tạo";
    case "DA_XAC_NHAN": return "Đã xác nhận";
    case "DANG_DONG_GOI": return "Đang đóng gói";
    case "DA_GIAO_VAN_CHUYEN": return "Đã giao vận chuyển";
    case "HOAN_THANH": return "Hoàn thành";
    case "DA_HUY": return "Đã hủy";
    case "TAM_LUU": return "Tạm lưu (POS)";
    default: return status;
  }
}

export function paymentStatusLabel(status: string): string {
  if (status === "CHUA_THANH_TOAN") return "Chưa thanh toán";
  if (status === "DA_THANH_TOAN") return "Đã thanh toán";
  return status;
}

export function paymentMethodLabel(method: string): string {
  if (method === "COD") return "COD — trả khi nhận hàng";
  if (method === "TIEN_MAT") return "Tiền mặt (POS)";
  return method;
}

export function isCustomerCancellable(order: Pick<OrderDetail, "trangThai" | "hanhDongChoPhep">): boolean {
  if (order.trangThai !== "MOI_TAO") return false;
  return order.hanhDongChoPhep.includes("HUY") || order.hanhDongChoPhep.includes("huy");
}

export function validateQuantity(raw: unknown): number {
  const n = typeof raw === "string" ? Number(raw) : (raw as number);
  if (!Number.isInteger(n) || n < 1 || n > 999) {
    throw new Error("Số lượng phải là số nguyên 1–999.");
  }
  return n;
}

export function validateReceiver(name: string, phone: string, address: string): void {
  if (!name.trim()) throw new Error("Nhập họ tên người nhận.");
  if ([...name.trim()].length > 100) throw new Error("Họ tên người nhận tối đa 100 ký tự.");
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 9 || digits.length > 11) throw new Error("Số điện thoại nhận hàng 9–11 chữ số.");
  if (!address.trim()) throw new Error("Nhập địa chỉ giao hàng.");
  if ([...address.trim()].length > 255) throw new Error("Địa chỉ giao hàng tối đa 255 ký tự.");
}

export function validateCancelReason(reason: string): string {
  const r = reason.trim();
  if (!r) throw new Error("Nhập lý do hủy.");
  if ([...r].length > 500) throw new Error("Lý do hủy tối đa 500 ký tự.");
  return r;
}

export function validateCashTender(tenderRaw: string, due: number): number {
  const tender = Number(String(tenderRaw).replace(/[\s₫]/g, "").replace(/\./g, "").replace(/,/g, ""));
  if (!Number.isFinite(tender) || tender <= 0) throw new Error("Tiền khách đưa phải là số dương.");
  if (!Number.isInteger(tender)) throw new Error("Tiền mặt tính bằng đồng, không nhận số lẻ.");
  if (tender < due) throw new Error(`Tiền khách đưa (${tender.toLocaleString("vi-VN")}₫) chưa đủ tổng phải thu (${due.toLocaleString("vi-VN")}₫).`);
  return tender;
}

export function formatVndContract(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return `${value.toLocaleString("vi-VN")}₫`;
}

/**
 * Nhãn voucher đã chốt. Mã voucher có thể vắng sau khi BE nhả usage (đơn đã
 * hủy) trong khi số tiền giảm vẫn nằm trong snapshot — không in "#" rỗng.
 */
export type DiscountLine = { label: string; amount: number | null };

/**
 * Các dòng giảm hiển thị từ dữ liệu máy chủ. Đơn legacy đã hủy
 * (phanBoGiamXacDinh = false) không còn bản ghi dùng voucher nên không suy được
 * phần nào là voucher, phần nào là điểm — chỉ hiện tổng giảm, không gán nhãn sai.
 */
export function discountLines(order: {
  phanBoGiamXacDinh?: boolean | null;
  giamGia?: number | null;
  giamVoucher?: number | null;
  giamDiem?: number | null;
  diemSuDung?: number | null;
  maVoucher?: number | null;
}): DiscountLine[] {
  const tong = order.giamGia ?? 0;
  if (order.phanBoGiamXacDinh === false) {
    // Đơn legacy đã hủy: không còn bản ghi dùng voucher nên không suy được phần nào
    // là voucher, phần nào là điểm — chỉ hiện tổng giảm, và không hiện dòng 0đ.
    return tong > 0 ? [{ label: "Tổng giảm (chưa xác định phân bổ)", amount: tong }] : [];
  }
  const lines: DiscountLine[] = [];
  if ((order.giamVoucher ?? 0) > 0 || (order.maVoucher ?? 0) > 0) {
    lines.push({ label: voucherChosenLabel(order.maVoucher, " (đã chốt)"), amount: order.giamVoucher ?? null });
  }
  if ((order.giamDiem ?? 0) > 0 || (order.diemSuDung ?? 0) > 0) {
    lines.push({ label: `Điểm đã dùng (${order.diemSuDung ?? 0}) (đã chốt)`, amount: order.giamDiem ?? null });
  }
  if (lines.length > 0) return lines;
  // Không có thông tin phân bổ (phản hồi cũ chưa có cờ): hiện đúng một dòng tổng giảm.
  return tong > 0 ? [{ label: "Giảm giá", amount: tong }] : [];
}

export function voucherChosenLabel(maVoucher: number | null | undefined, suffix = ""): string {
  const id = maVoucher ?? null;
  return id !== null && id !== 0 ? `Voucher #${id}${suffix}` : `Voucher${suffix}`;
}

/** Lỗi HTTP → câu VI trung thực, giữ input/filters ở caller. */
export function commerceErrorMessage(status: number, fallback: string): string {
  if (status === 400) return fallback || "Yêu cầu chưa hợp lệ. Kiểm tra lại thông tin rồi thử tiếp.";
  if (status === 401) return "Phiên đăng nhập đã hết. Đăng nhập lại rồi tiếp tục.";
  if (status === 403) return "Tài khoản của bạn không có quyền thực hiện thao tác này.";
  if (status === 404) return "Không tìm thấy (có thể không thuộc về bạn).";
  if (status === 409) return "Dữ liệu đã đổi trên máy chủ (giá/kho/phiên bản). Tải lại báo giá rồi xem lại trước khi tiếp tục.";
  if (status === 502) return "Máy chủ trả về không đúng định dạng. Thử lại sau ít phút.";
  if (status === 503) return "Máy chủ chưa sẵn sàng. Thử lại sau ít phút.";
  return fallback;
}

export function buildOrderQuery(params: {
  page: number; size: number; trangThai?: string;
}): string {
  const page = Math.max(0, Math.floor(params.page));
  const size = Math.min(100, Math.max(1, Math.floor(params.size)));
  const q = new URLSearchParams({ page: String(page), size: String(size) });
  if (params.trangThai) q.set("trangThai", params.trangThai);
  return q.toString();
}

export function buildStaffOrderQuery(params: {
  page: number; size: number; maDonHang?: string; sdt?: string;
  tuNgay?: string; denNgay?: string; trangThai?: string; kenhBan?: string;
}): string {
  const q = new URLSearchParams({
    page: String(Math.max(0, Math.floor(params.page))),
    size: String(Math.min(100, Math.max(1, Math.floor(params.size)))),
  });
  for (const [k, v] of Object.entries(params)) {
    if (k === "page" || k === "size") continue;
    if (v) q.set(k, String(v));
  }
  return q.toString();
}

export function nextOnlineState(current: string): string | null {
  const i = ONLINE_SEQ.indexOf(current);
  if (i < 0 || i >= ONLINE_SEQ.length - 1) return null;
  return ONLINE_SEQ[i + 1];
}

export { ONLINE_SEQ };
