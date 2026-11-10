export type LedgerType = "OPENING" | "HOLD" | "RELEASE" | "REDEEM" | "EARN" | "ADJUST" | "RETURN_REVERSE" | "RETURN_REDEEM";
export type AdminLedgerItem = {
  entryId: number; type: LedgerType; points: number; delta: number; balanceAfter: number | null;
  orderId: number | null; orderCode: string | null; reasonCode: string | null; note: string | null; actor: string | null; occurredAt: string;
};
export type LedgerPage = { content: AdminLedgerItem[]; pageNumber: number; pageSize: number; totalElements: number; totalPages: number; last: boolean };
export type AdjustResult = { entryId: number; customerId: number; delta: number; balanceBefore: number | null; balanceAfter: number | null; reasonCode: string; occurredAt: string; replayed: boolean };
export type EarnRecalc = {
  orderId: number; orderCode: string | null; customerId: number | null; eligible: boolean; reason: string | null;
  paidAmount: number | null; points: number | null; policyId: number | null; policyVersion: number | null; earnCurrencyPerPoint: number | null;
  policySource: "ORDER_SNAPSHOT" | "CURRENT_POLICY" | null; balanceBefore: number | null; balanceAfter: number | null; applied: boolean;
};

export class LoyaltyAdminError extends Error {
  status: number;
  constructor(message: string, status: number) { super(message); this.name = "LoyaltyAdminError"; this.status = status; }
}

export const ADJUST_REASONS: { code: string; label: string }[] = [
  { code: "BOI_THUONG", label: "Bồi thường" },
  { code: "DIEU_CHINH_SAI_SOT", label: "Điều chỉnh sai sót" },
  { code: "TANG_THEM", label: "Tặng thêm" },
  { code: "HOAN_DON", label: "Hoàn đơn" },
  { code: "KHAC", label: "Khác" },
];

export const ledgerTypeLabel = (type: string): string => ({
  OPENING: "Số dư mở đầu", HOLD: "Giữ điểm", RELEASE: "Nhả giữ", REDEEM: "Dùng điểm", EARN: "Tích điểm", ADJUST: "Điều chỉnh", RETURN_REVERSE: "Thu hồi điểm đơn trả", RETURN_REDEEM: "Hoàn điểm đã đổi",
} as Record<string, string>)[type] ?? type;

export const reasonLabel = (code: string | null): string | null => {
  if (!code) return null;
  if (code === "TINH_LAI_DON") return "Tính lại điểm cho đơn";
  return ADJUST_REASONS.find((r) => r.code === code)?.label ?? null;
};

const FIELD_REASONS: Record<string, string> = {
  BELOW_ZERO: "Số điểm sau điều chỉnh không được nhỏ hơn 0.",
  BELOW_HELD: "Số dư sau điều chỉnh không được thấp hơn số điểm đang giữ cho đơn chưa hoàn tất.",
  OVER_MAX: "Số dư sau điều chỉnh vượt quá mức tối đa cho phép.",
  NON_ZERO: "Số điểm điều chỉnh phải khác 0.",
  REQUIRED_FOR_OTHER: "Lý do Khác cần có ghi chú.",
  INVALID_REASON: "Hãy chọn lý do điều chỉnh.",
  TOO_LONG: "Ghi chú tối đa 500 ký tự.",
};

export const RECALC_REASONS: Record<string, string> = {
  NO_CUSTOMER: "Đơn không gắn với khách hàng nên không tích điểm.",
  NOT_PAID: "Đơn chưa ghi nhận thanh toán.",
  STATUS: "Trạng thái đơn hiện tại không được tích điểm.",
  ALREADY_EARNED: "Đơn này đã được tích điểm.",
  NO_POLICY: "Chưa có chính sách điểm đang áp dụng.",
  ZERO_POINTS: "Số tiền đã trả chưa đủ để đổi ra 1 điểm.",
  STATE_CONFLICT: "Trạng thái điểm của đơn chưa nhất quán. Kiểm tra lại đơn trước khi tính.",
};

type Envelope<T> = { success?: boolean; message?: string; code?: string | number; errors?: { field?: string; reason?: string }[]; result?: T };

async function parse<T>(r: Response): Promise<T> {
  let j: Envelope<T> | null = null;
  try { j = await r.json(); } catch { /* non-JSON */ }
  if (!r.ok || j?.success !== true || j.result === undefined) {
    const reason = j?.errors?.map((e) => FIELD_REASONS[e.reason ?? ""]).find(Boolean);
    throw new LoyaltyAdminError(reason || j?.message || "Yêu cầu điểm thưởng thất bại.", r.status || 502);
  }
  return j.result;
}

const json = { "content-type": "application/json" };

export const getPointHistory = async (customerId: string | number, page: number, size: number, signal?: AbortSignal) =>
  parse<LedgerPage>(await fetch(`/api/admin/loyalty/customers/${customerId}/history?page=${page}&size=${size}`, { cache: "no-store", signal }));

export const adjustPoints = async (customerId: string | number, body: { delta: number; reasonCode: string; note: string | null; requestId: string }) =>
  parse<AdjustResult>(await fetch(`/api/admin/loyalty/customers/${customerId}/adjust`, { method: "POST", headers: json, body: JSON.stringify(body) }));

export const previewEarnRecalc = async (orderId: string | number, signal?: AbortSignal) =>
  parse<EarnRecalc>(await fetch(`/api/admin/loyalty/orders/${orderId}/recalc`, { cache: "no-store", signal }));

export const applyEarnRecalc = async (orderId: string | number) =>
  parse<EarnRecalc>(await fetch(`/api/admin/loyalty/orders/${orderId}/recalc`, { method: "POST", headers: json, body: "{}" }));

export const newRequestId = (): string =>
  typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
