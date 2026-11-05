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
  customerId: number;
  balancePoints: number;
  heldPoints: number;
  availablePoints: number | null;
  cumulativePaidSales: number | null;
  salesTierId: number | null;
  salesTierName: string | null;
  salesTierStatus: "KNOWN" | "NO_CONFIGURED_THRESHOLDS" | "HISTORY_UNKNOWN";
  openingRecorded: boolean;
  policyStatus: "UNCONFIGURED" | "DISABLED" | "ENABLED";
  currentPolicyId: number | null;
  currentPolicyVersion: number | null;
};

export type LoyaltyHistoryEntry = {
  entryId: number;
  type: "OPENING" | "HOLD" | "RELEASE" | "REDEEM" | "EARN";
  points: number;
  orderId: number | null;
  occurredAt: string;
};

export type PolicyState = "ENABLED" | "DISABLED";

export type LoyaltyPolicy = {
  policyId: number;
  version: number;
  earnCurrencyPerPoint: number;
  redeemCurrencyPerPoint: number;
  status: PolicyState;
  createdAt: string;
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

export function loyaltyActionLabel(type: string): string {
  switch (type) {
    case "OPENING": return "Số dư mở đầu";
    case "HOLD": return "Giữ điểm";
    case "RELEASE": return "Nhả giữ";
    case "REDEEM": return "Dùng điểm";
    case "EARN": return "Tích điểm";
    default: return type;
  }
}

/** Tên hạng hiển thị duy nhất (nguồn: loyalty summary) — dùng chung cho
 *  trang điểm thưởng, hồ sơ và hub tài khoản. Không bịa tên khi thiếu. */
export function loyaltyTierDisplayName(balance: LoyaltyBalance): string {
  if (balance.salesTierName) return balance.salesTierName;
  return balance.salesTierStatus === "HISTORY_UNKNOWN" ? "Chưa đủ dữ liệu" : "Chưa xếp hạng";
}

/** dd/MM/yyyy HH:mm cho lịch sử điểm — không bao giờ hiện ISO thô. */
export function formatVnDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** Chuỗi số điểm có dấu cho lịch sử: OPENING là số dư nền (+N, trung tính). */
export function loyaltyHistoryAmount(type: string, points: number): { text: string; direction: "up" | "down" | "flat" } {
  if (type === "OPENING") return { text: `+${points} điểm`, direction: "flat" };
  const signed = loyaltySignedPoints(type, points);
  if (signed > 0) return { text: `+${points} điểm`, direction: "up" };
  if (signed < 0) return { text: `−${points} điểm`, direction: "down" };
  return { text: `${points} điểm`, direction: "flat" };
}

/** OPENING is a baseline, while HOLD/RELEASE only move the available balance. */
export function loyaltySignedPoints(type: string, points: number): number {
  if (type === "OPENING") return 0;
  return type === "HOLD" || type === "REDEEM" ? -Math.abs(points) : Math.abs(points);
}

/** Lỗi benefit → câu VI trung thực, giữ input ở caller. */
export function benefitErrorMessage(status: number, code: string | null, fallback: string): string {
  const c = (code ?? "").toUpperCase();
  if (c === "4201" || c.includes("LEGACY_OPENING_REQUIRED")) return "Số dư điểm cũ chưa được ghi nhận mở đầu; quản trị viên cần thực hiện bước này trước khi đổi điểm.";
  if (c === "4202" || c.includes("LOYALTY_POLICY_UNAVAILABLE")) return "Chưa có chính sách điểm để đổi.";
  if (c === "4203" || c.includes("LOYALTY_POLICY_DISABLED")) return "Chính sách điểm đang tắt; điểm vẫn được giữ nguyên.";
  if (c === "4204" || c.includes("INSUFFICIENT")) return "Điểm vượt quá số dư hoặc mức giảm tối đa hiện tại.";
  if (c === "4205" || c.includes("OPENING_ALREADY_RECORDED")) return "Số dư khách đã được ghi nhận mở đầu trước đó.";
  if (c === "4206" || c.includes("LOYALTY_POLICY_VERSION_CHANGED")) return "Chính sách đã đổi. Tải lại rồi thử lại.";
  if (c === "4207" || c.includes("LOYALTY_TIER_VERSION_CHANGED")) return "Ngưỡng hạng đã đổi. Tải lại rồi thử lại.";
  if (c === "4208" || c.includes("LOYALTY_STATE_CONFLICT")) return "Trạng thái điểm đã thay đổi đồng thời. Tải lại báo giá.";
  if (c.includes("EXPIRED") || c.includes("HET_HAN")) return "Voucher đã hết hạn.";
  if (c.includes("DISABLE") || c.includes("TAT") || c.includes("PAUSE")) return "Ưu đãi đang tắt/tạm dừng.";
  if (c.includes("MISMATCH") || c.includes("KHONG_AP_DUNG")) return "Voucher không áp dụng cho đơn này.";
  if (c.includes("EXHAUST") || c.includes("HET_LUOT")) return "Mã đã hết lượt sử dụng.";
  if (status === 409) return "Dữ liệu ưu đãi hoặc chính sách đã thay đổi. Tải lại báo giá và xác nhận lại trước khi tiếp tục.";
  if (status === 404) return "Không tìm thấy dữ liệu yêu cầu hoặc dữ liệu không thuộc về bạn.";
  if (status === 401) return "Phiên đăng nhập đã hết. Đăng nhập lại rồi tiếp tục.";
  if (status === 403) return "Tài khoản của bạn không có quyền thực hiện thao tác này.";
  return fallback;
}
