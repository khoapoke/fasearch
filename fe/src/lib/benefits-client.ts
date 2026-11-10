// Isolated benefit adapters — promotions/loyalty (common CONTRACT revision 1 + BE CONTRACT PROPOSED revision 1).
// FE conforms exact suggested/frozen names: dang-mo, thanh-vien, voucherCode, giamVoucher/giamDiem,
// diemDuocPhep, maChinhSach/phienBanChinhSach, BAT/TAT, SO_TIEN. Không mock trong app;
// test-only fixtures nằm trong tests/*.test.mjs và có nhãn rõ.

import { beFetch, unwrap } from "./mgmt-client.ts";
import type {
  LoyaltyBalance, LoyaltyHistoryEntry, LoyaltyPolicy, PolicyState, VoucherOffer,
} from "./benefits.ts";

export type Paged<T> = {
  data: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
};

type LoyaltyEnvelope<T> = { success?: boolean; code?: number | string; message?: string; result?: T; errors?: Array<{ reason?: string }> };

async function loyaltyRequest<T>(path: string, method: "GET" | "POST" | "PUT" = "GET", body?: unknown): Promise<T> {
  // BE là JWT-only (CSRF tắt): BFF /api/admin/loyalty/* xác thực bằng cookie phiên, không cần mã CSRF.
  const headers: Record<string, string> = method !== "GET" ? { "content-type": "application/json" } : {};
  const response = await fetch(path, {
    method,
    headers,
    ...(method !== "GET" ? { body: JSON.stringify(body) } : {}),
    cache: "no-store",
  });
  const payload = await response.json().catch(() => null) as LoyaltyEnvelope<T> | null;
  if (!response.ok || payload?.success !== true || !payload.result) {
    const message = payload?.message || `Yêu cầu thất bại (HTTP ${response.status}).`;
    const reasons = payload?.errors?.map((error) => error.reason).filter((reason): reason is string => Boolean(reason));
    throw Object.assign(new Error(reasons?.length ? `${message}: ${reasons.join("; ")}` : message), {
      status: response.status,
      code: payload?.code === undefined ? "" : String(payload.code),
    });
  }
  return payload.result;
}

function balance(value: unknown): LoyaltyBalance {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Phản hồi số dư điểm không hợp lệ.");
  const v = value as Record<string, unknown>;
  const isSafeInt = (value: unknown, min = 0) => typeof value === "number" && Number.isSafeInteger(value) && value >= min;
  const nullableSafeInt = (field: string, min = 0) => v[field] === null || isSafeInt(v[field], min);
  const nullableMoney = (field: string) => v[field] === null || (typeof v[field] === "number" && Number.isFinite(v[field]) && v[field] >= 0);
  if (!isSafeInt(v.customerId, 1) || !isSafeInt(v.balancePoints) || !isSafeInt(v.heldPoints) || !nullableSafeInt("availablePoints")
    || !nullableMoney("cumulativePaidSales") || !nullableSafeInt("salesTierId", 1)
    || !(v.salesTierName === null || typeof v.salesTierName === "string")
    || !["KNOWN", "NO_CONFIGURED_THRESHOLDS", "HISTORY_UNKNOWN"].includes(String(v.salesTierStatus))
    || typeof v.openingRecorded !== "boolean" || !["UNCONFIGURED", "DISABLED", "ENABLED"].includes(String(v.policyStatus))
    || !nullableSafeInt("currentPolicyId", 1) || !nullableSafeInt("currentPolicyVersion", 1)) throw new Error("Phản hồi số dư điểm không hợp lệ.");
  return v as unknown as LoyaltyBalance;
}

function pageResult<T>(value: unknown, map: (item: unknown) => T): Paged<T> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Phản hồi trang không hợp lệ.");
  const v = value as Record<string, unknown>;
  if (!Array.isArray(v.content) || !Number.isSafeInteger(v.pageNumber) || (v.pageNumber as number) < 0
    || !Number.isSafeInteger(v.pageSize) || (v.pageSize as number) < 1 || (v.pageSize as number) > 100
    || !Number.isSafeInteger(v.totalElements) || (v.totalElements as number) < 0
    || !Number.isSafeInteger(v.totalPages) || (v.totalPages as number) < 0 || typeof v.last !== "boolean") throw new Error("Phản hồi trang không hợp lệ.");
  return { data: v.content.map(map), page: v.pageNumber as number, size: v.pageSize as number, totalElements: v.totalElements as number, totalPages: v.totalPages as number };
}

// ---- Published offers (customer-safe) ----

export async function fetchPublishedOffers(): Promise<VoucherOffer[]> {
  const r = await beFetch("v1/khuyen-mai/dang-mo");
  return unwrap<VoucherOffer[]>(r);
}

// ---- Customer-safe policy projection (không dùng endpoint ADMIN) ----

export type OwnPolicy = {
  policy: { policyId: number; version: number; status: string; earnCurrencyPerPoint: number; redeemCurrencyPerPoint: number };
  tiers: Array<{ tierId: number; name: string; minimumCumulativePaidSales: number; version: number }>;
  balance: LoyaltyBalance;
};

export async function fetchOwnLoyaltyPolicy(): Promise<OwnPolicy> {
  const raw = await loyaltyRequest<unknown>("/api/customer-commerce/loyalty/policy");
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error("Phản hồi chính sách không hợp lệ.");
  const v = raw as Record<string, unknown>;
  const policy = v.policy as Record<string, unknown> | undefined;
  if (!policy || !Number.isSafeInteger(policy.policyId) || !Number.isFinite(policy.earnCurrencyPerPoint) || !Number.isFinite(policy.redeemCurrencyPerPoint)) {
    throw new Error("Chính sách điểm không hợp lệ.");
  }
  const tiers = Array.isArray(v.tiers) ? v.tiers.filter((t): t is Record<string, unknown> => Boolean(t) && typeof t === "object") : [];
  return {
    balance: balance(v.balance),
    policy: {
      policyId: policy.policyId as number,
      version: Number(policy.version ?? 0),
      status: String(policy.status ?? ""),
      earnCurrencyPerPoint: policy.earnCurrencyPerPoint as number,
      redeemCurrencyPerPoint: policy.redeemCurrencyPerPoint as number,
    },
    tiers: tiers
      .filter((t) => typeof t.name === "string" && Number.isFinite(t.minimumCumulativePaidSales) && Number.isSafeInteger(t.tierId))
      .map((t) => ({ tierId: t.tierId as number, name: t.name as string, minimumCumulativePaidSales: t.minimumCumulativePaidSales as number, version: Number(t.version ?? 0) }))
      .sort((a, b) => a.minimumCumulativePaidSales - b.minimumCumulativePaidSales),
  };
}

// ---- Contract v1.3 loyalty reads ----

export type OwnLoyalty = { balance: LoyaltyBalance; customerId: number };

export async function fetchOwnLoyalty(): Promise<OwnLoyalty> {
  const result = balance(await loyaltyRequest<unknown>("/api/customer-commerce/loyalty"));
  return { customerId: result.customerId, balance: result };
}

export async function fetchOwnLoyaltyHistory(query: string): Promise<Paged<LoyaltyHistoryEntry>> {
  const params = new URLSearchParams(query);
  const result = await loyaltyRequest<unknown>(`/api/customer-commerce/loyalty/history?${params}`);
  return pageResult(result, (raw) => {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error("Dòng lịch sử điểm không hợp lệ.");
    const h = raw as Record<string, unknown>;
    if (!Number.isSafeInteger(h.entryId) || (h.entryId as number) < 1 || !["OPENING", "HOLD", "RELEASE", "REDEEM", "EARN", "ADJUST", "RETURN_REVERSE", "RETURN_REDEEM"].includes(String(h.type))
      || !Number.isSafeInteger(h.points) || (h.type === "ADJUST" ? h.points === 0 : (h.points as number) < (h.type === "OPENING" || h.type === "RETURN_REVERSE" ? 0 : 1)) || typeof h.occurredAt !== "string"
      || !(h.orderId === null || (Number.isSafeInteger(h.orderId) && (h.orderId as number) > 0))) throw new Error("Dòng lịch sử điểm không hợp lệ.");
    return h as unknown as LoyaltyHistoryEntry;
  });
}

export async function fetchStaffCustomerLoyalty(customerId: number | string): Promise<LoyaltyBalance> {
  return balance(await loyaltyRequest<unknown>(`/api/staff/loyalty/customers/${encodeURIComponent(String(customerId))}`));
}

// ---- ADMIN campaigns ----

export type CampaignState = "NHAP" | "HOAT_DONG" | "TAM_DUNG" | "HET_HAN" | string;

export type Campaign = {
  maKm: number;
  tenCtkm: string;
  loaiGiam: "PHAN_TRAM" | "SO_TIEN" | string;
  giaTriGiam: number;
  ngayBatDau: string;
  ngayKetThuc: string;
  maSpApDung?: number[] | null;
  trangThai: CampaignState;
  phienBan: number;
};

export async function fetchCampaigns(query: string): Promise<Paged<Campaign>> {
  const r = await beFetch(`v1/khuyen-mai?${query}`);
  return unwrap<Paged<Campaign>>(r);
}

export async function fetchCampaign(id: number | string): Promise<Campaign> {
  const r = await beFetch(`v1/khuyen-mai/${encodeURIComponent(String(id))}`);
  return unwrap<Campaign>(r);
}

// ---- ADMIN loyalty policy and monetary tiers (contract v1.3) ----

export type LoyaltyPolicyAdmin = LoyaltyPolicy;

export function policyId(policy: LoyaltyPolicyAdmin): string {
  if (!Number.isSafeInteger(policy.policyId) || policy.policyId < 1) throw new Error("Phản hồi chính sách thiếu mã hợp lệ.");
  return String(policy.policyId);
}

export async function fetchLoyaltyPolicy(): Promise<LoyaltyPolicyAdmin[]> {
  const result = await loyaltyRequest<unknown>("/api/admin/loyalty/policies?page=0&size=20");
  return pageResult(result, (raw) => {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error("Dòng chính sách không hợp lệ.");
    const p = raw as Record<string, unknown>;
    if (!Number.isSafeInteger(p.policyId) || (p.policyId as number) < 1 || !Number.isSafeInteger(p.version) || (p.version as number) < 1
      || typeof p.earnCurrencyPerPoint !== "number" || !Number.isFinite(p.earnCurrencyPerPoint)
      || typeof p.redeemCurrencyPerPoint !== "number" || !Number.isFinite(p.redeemCurrencyPerPoint)
      || !["ENABLED", "DISABLED"].includes(String(p.status)) || typeof p.createdAt !== "string") throw new Error("Dòng chính sách không hợp lệ.");
    return p as unknown as LoyaltyPolicyAdmin;
  }).data;
}

export async function createLoyaltyPolicy(body: {
  earnCurrencyPerPoint: number; redeemCurrencyPerPoint: number; status: PolicyState;
}): Promise<LoyaltyPolicyAdmin> {
  return loyaltyRequest<LoyaltyPolicyAdmin>("/api/admin/loyalty/policies", "POST", body);
}

export async function updateLoyaltyPolicy(policyId: number | string, body: {
  version: number; earnCurrencyPerPoint: number; redeemCurrencyPerPoint: number; status: PolicyState;
}): Promise<LoyaltyPolicyAdmin> {
  return loyaltyRequest<LoyaltyPolicyAdmin>(`/api/admin/loyalty/policies/${encodeURIComponent(String(policyId))}`, "PUT", body);
}

export type TierInfo = { tierId: number; name: string; minimumCumulativePaidSales: number | null; version: number };

export async function updateTierThreshold(tierId: number | string, version: number, minimumCumulativePaidSales: number): Promise<TierInfo> {
  return loyaltyRequest<TierInfo>(`/api/admin/loyalty/tiers/${encodeURIComponent(String(tierId))}`, "PUT", { version, minimumCumulativePaidSales });
}

export async function fetchTierList(): Promise<TierInfo[]> {
  const rows = await loyaltyRequest<unknown>("/api/admin/loyalty/tiers");
  if (!Array.isArray(rows)) throw new Error("Danh sách hạng không hợp lệ.");
  return rows.map((raw) => {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error("Dòng hạng không hợp lệ.");
    const t = raw as Record<string, unknown>;
    if (!Number.isSafeInteger(t.tierId) || (t.tierId as number) < 1 || typeof t.name !== "string"
      || !(t.minimumCumulativePaidSales === null || (typeof t.minimumCumulativePaidSales === "number" && Number.isFinite(t.minimumCumulativePaidSales)))
      || !Number.isSafeInteger(t.version) || (t.version as number) < 0) throw new Error("Dòng hạng không hợp lệ.");
    return t as unknown as TierInfo;
  });
}

export async function openLegacyBalance(customerId: number | string): Promise<unknown> {
  return loyaltyRequest<unknown>("/api/admin/loyalty/opening", "POST", { customerId: Number(customerId) });
}
