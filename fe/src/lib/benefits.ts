// Pure benefits helpers — promotions/loyalty (common CONTRACT revision 1 + DECISIONS).
// Không fetch, không mock. Server authoritative; client chỉ validate đầu vào,
// canonical mã, hiển thị split và map lỗi trung thực.

export type DiscountKind = "PHAN_TRAM" | "SO_TIEN";

export type VoucherOffer = {
  maKm?: number | null;
  tenCtkm: string;
  loaiGiam: DiscountKind;
  giaTriGiam: number;
  ngayKetThuc?: string | null;
  conLai?: number | null;
};

export type LoyaltyBalance = {
  soDu: number;
  khaDung: number;
  dangGiu: number;
  tongChiTieu: number;
  tierName: string | null;
  daMoDau?: boolean | null;
};

export type LoyaltyHistoryEntry = {
  id: number | string;
  loai: "TICH" | "TIEU" | "GIU" | "NHA_GIU" | "NHA" | string;
  diem: number;
  thoiGian: string;
  maDonHang?: number | string | null;
};

export type PolicyState = "BAT" | "TAT";

export type LoyaltyPolicy = {
  trangThai: PolicyState | string;
  tyLeTich?: number | null;
  giaTriDiem?: number | null;
  phienBan?: number | null;
};

/** Canonical mã voucher: trim + UPPERCASE, 1..32 ký tự A-Z0-9_- . */
export function canonicalVoucherCode(raw: string): string {
  const code = raw.trim().toUpperCase();
  if (!code) throw new Error("Nhập mã voucher.");
  if (code.length > 32 || !/^[A-Z0-9_-]+$/.test(code)) {
    throw new Error("Mã voucher 1–32 ký tự: chữ, số, gạch dưới hoặc gạch ngang.");
  }
  return code;
}

/**
 * Validate điểm nhập: integer >= 0, <= available và không vượt
 * remainingMerchandise (quy ra điểm khi biết giaTriDiem, ngược lại chặn bởi allowedMax).
 */
export function validatePointsInput(
  raw: string,
  available: number,
  opts?: { remainingMerch?: number; giaTriDiem?: number | null; allowedMax?: number | null },
): number {
  const text = raw.trim();
  if (!text) return 0;
  if (!/^[0-9]+$/.test(text)) throw new Error("Điểm phải là số nguyên không âm.");
  const n = Number(text);
  if (!Number.isSafeInteger(n)) throw new Error("Điểm vượt quá giới hạn cho phép.");
  if (n > available) throw new Error(`Chỉ còn ${available.toLocaleString("vi-VN")} điểm khả dụng.`);
  const cap = opts?.allowedMax ?? null;
  if (cap !== null && cap !== undefined && n > cap) {
    throw new Error(`Máy chủ chỉ cho phép tối đa ${cap.toLocaleString("vi-VN")} điểm cho đơn này.`);
  }
  const giaTri = opts?.giaTriDiem ?? null;
  const remaining = opts?.remainingMerch ?? null;
  if (giaTri !== null && giaTri > 0 && remaining !== null && n * giaTri > remaining) {
    const maxByMoney = Math.floor(remaining / giaTri);
    throw new Error(`Điểm vượt tiền hàng còn lại (tối đa ${maxByMoney.toLocaleString("vi-VN")} điểm).`);
  }
  return n;
}

/** Ưu đãi trên form đã khác bản đã báo giá → phải re-quote trước khi submit (R3-F1). */
export function appliedBenefitsChanged(
  voucherNow: string | null,
  pointsNow: number,
  appliedVoucher: string | null,
  appliedPoints: number,
): boolean {
  return voucherNow !== appliedVoucher || pointsNow !== appliedPoints;
}

/** Hiển thị split server: payable không âm; client không tự quyết tiền. */export function splitPayable(goods: number, voucherDiscount: number, pointsDiscount: number): number {
  const g = Number.isFinite(goods) ? goods : 0;
  const v = Number.isFinite(voucherDiscount) ? voucherDiscount : 0;
  const p = Number.isFinite(pointsDiscount) ? pointsDiscount : 0;
  return Math.max(0, g - v - p);
}

export function discountKindLabel(kind: DiscountKind | string): string {
  if (kind === "PHAN_TRAM") return "theo đơn";
  if (kind === "SO_TIEN") return "cố định";
  return String(kind);
}

export function loyaltyActionLabel(loai: string): string {
  switch (loai) {
    case "TICH": return "Tích điểm";
    case "TIEU": return "Dùng điểm";
    case "GIU": return "Giữ điểm";
    case "NHA":
    case "NHA_GIU": return "Nhả giữ";
    default: return loai;
  }
}

/** Ledger lưu số dương cho cả thu lẫn chi; dấu hiển thị theo loại. */
export function loyaltySignedPoints(loai: string, diem: number): number {
  const out = loai === "TIEU" || loai === "GIU";
  return out ? -Math.abs(diem) : Math.abs(diem);
}

/** Lỗi benefit → câu VI trung thực, giữ input ở caller. */
export function benefitErrorMessage(status: number, code: string | null, fallback: string): string {
  const c = (code ?? "").toUpperCase();
  if (c.includes("EXPIRED") || c.includes("HET_HAN")) return "Voucher đã hết hạn.";
  if (c.includes("DISABLE") || c.includes("TAT") || c.includes("PAUSE")) return "Ưu đãi đang tắt/tạm dừng.";
  if (c.includes("MISMATCH") || c.includes("KHONG_AP_DUNG")) return "Voucher không áp dụng cho đơn này.";
  if (c.includes("INSUFFICIENT") || c.includes("KHONG_DU")) return "Điểm không đủ hoặc vượt tiền hàng còn lại.";
  if (c.includes("EXHAUST") || c.includes("HET_LUOT")) return "Mã đã hết lượt sử dụng.";
  if (status === 409) return "Dữ liệu ưu đãi đã đổi (giá/policy/quota/điểm). Tải lại báo giá rồi tiếp tục — không tự thử lại.";
  if (status === 404) return "Không tìm thấy mã hoặc không thuộc về bạn.";
  if (status === 401) return "Phiên đăng nhập đã hết. Đăng nhập lại rồi tiếp tục.";
  if (status === 403) return "Tài khoản của bạn không có quyền thực hiện thao tác này.";
  return fallback;
}
