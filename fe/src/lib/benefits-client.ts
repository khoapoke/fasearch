// Isolated benefit adapters — promotions/loyalty (common CONTRACT revision 1 + BE CONTRACT PROPOSED revision 1).
// FE conforms exact suggested/frozen names: dang-mo, thanh-vien, voucherCode, giamVoucher/giamDiem,
// diemDuocPhep, maChinhSach/phienBanChinhSach, BAT/TAT, SO_TIEN. Không mock trong app;
// test-only fixtures nằm trong tests/*.test.mjs và có nhãn rõ.

import { beFetch, beWrite, unwrap } from "./mgmt-client.ts";
import type {
  LoyaltyBalance, LoyaltyHistoryEntry, LoyaltyPolicy, VoucherOffer,
} from "./benefits.ts";

export type Paged<T> = {
  data: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
};

// ---- Published offers (customer-safe) ----

export async function fetchPublishedOffers(): Promise<VoucherOffer[]> {
  const r = await beFetch("v1/khuyen-mai/dang-mo");
  return unwrap<VoucherOffer[]>(r);
}

// ---- Own loyalty (BE trả phẳng LoyaltyBalanceResponse) ----

export type FlatLoyalty = {
  maKh: number; soDu: number; khaDung: number; dangGiu: number;
  tongChiTieu: number; tenHang?: string | null; daMoDau?: boolean | null;
};

export type OwnLoyalty = {
  balance: LoyaltyBalance;
  maKh: number;
};

export async function fetchOwnLoyalty(): Promise<OwnLoyalty> {
  const r = await beFetch("v1/thanh-vien");
  const flat = await unwrap<FlatLoyalty>(r);
  return {
    maKh: flat.maKh,
    balance: {
      soDu: flat.soDu, khaDung: flat.khaDung, dangGiu: flat.dangGiu,
      tongChiTieu: flat.tongChiTieu, tierName: flat.tenHang ?? null, daMoDau: flat.daMoDau ?? null,
    },
  };
}

type RawLedger = { maGd: number | string; loai: string; soDiem: number; maDonHang?: number | string | null; thoiGian: string };

export async function fetchOwnLoyaltyHistory(query: string): Promise<Paged<LoyaltyHistoryEntry>> {
  const r = await beFetch(`v1/thanh-vien/lich-su?${query}`);
  const pg = await unwrap<Paged<RawLedger>>(r);
  return {
    ...pg,
    data: pg.data.map((h) => ({ id: h.maGd, loai: h.loai, diem: h.soDiem, thoiGian: h.thoiGian, maDonHang: h.maDonHang ?? null })),
  };
}

export async function fetchStaffCustomerLoyalty(maKh: number | string): Promise<LoyaltyBalance> {
  const r = await beFetch(`v1/thanh-vien/khach-hang/${encodeURIComponent(String(maKh))}`);
  return unwrap<LoyaltyBalance>(r);
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

export async function createCampaign(body: {
  tenCtkm: string; loaiGiam: string; giaTriGiam: number;
  ngayBatDau: string; ngayKetThuc: string; maSpApDung?: number[];
}): Promise<Campaign> {
  const r = await beWrite("v1/khuyen-mai", "POST", body);
  return unwrap<Campaign>(r);
}

export type CreatedCode = {
  maVoucher: number; maCode: string; soLuongPhatHanh: number | null; daSuDung: number; soLuongGiuCho?: number | null;
};

export async function addCampaignCode(id: number | string, body: {
  maCode: string; soLuongPhatHanh: number | null;
}): Promise<CreatedCode> {
  const r = await beWrite(`v1/khuyen-mai/${encodeURIComponent(String(id))}/codes`, "POST", body);
  return unwrap<CreatedCode>(r);
}

export type CampaignUpdate = {
  phienBan: number;
  tenCtkm?: string; loaiGiam?: string; giaTriGiam?: number;
  ngayBatDau?: string; ngayKetThuc?: string; dieuKienApDung?: string;
  maSpApDung?: number[]; trangThai?: "HOAT_DONG" | "TAM_DUNG";
};

export async function updateCampaign(id: number | string, body: CampaignUpdate): Promise<Campaign> {
  const r = await beWrite(`v1/khuyen-mai/${encodeURIComponent(String(id))}`, "PUT", body);
  return unwrap<Campaign>(r);
}

// ---- ADMIN loyalty policy (BAT duy nhất, default TAT) ----

export type LoyaltyPolicyAdmin = LoyaltyPolicy & {
  id?: number | string | null;
  maChinhSach?: number | string | null;
  phienBan: number;
};

export function policyId(p: LoyaltyPolicyAdmin): string {
  const id = p.id ?? p.maChinhSach ?? p.phienBan;
  if (id === undefined || id === null || String(id).trim() === "") {
    throw new Error("Phản hồi chính sách thiếu id — không gọi cập nhật mù.");
  }
  return String(id);
}

export async function fetchLoyaltyPolicy(): Promise<LoyaltyPolicyAdmin[]> {
  const r = await beFetch("v1/thanh-vien/chinh-sach?page=0&size=20");
  if (r.status === 404) return [];
  const pg = await unwrap<Paged<LoyaltyPolicyAdmin>>(r);
  return pg.data;
}

export async function createLoyaltyPolicy(body: {
  tyLeTich: number; giaTriDiem: number; trangThai?: "BAT" | "TAT";
}): Promise<LoyaltyPolicyAdmin> {
  const r = await beWrite("v1/thanh-vien/chinh-sach", "POST", body);
  return unwrap<LoyaltyPolicyAdmin>(r);
}

export async function updateLoyaltyPolicy(id: number | string, body: {
  phienBan: number; tyLeTich?: number; giaTriDiem?: number; trangThai?: "BAT" | "TAT";
}): Promise<LoyaltyPolicyAdmin> {
  const r = await beWrite(`v1/thanh-vien/chinh-sach/${encodeURIComponent(String(id))}`, "PUT", body);
  return unwrap<LoyaltyPolicyAdmin>(r);
}

export async function updateTierThreshold(maHang: number | string, nguongDoanhSo: number): Promise<unknown> {
  const r = await beWrite(`v1/thanh-vien/chinh-sach/hang/${encodeURIComponent(String(maHang))}`, "PUT", { nguongDoanhSo });
  return unwrap<unknown>(r);
}

export type TierInfo = {
  maHang: number; tenHang: string; nguongDiem?: number | null;
  nguongDoanhSo?: number | null; quyenLoi?: string | null;
};

// Danh sách hạng ADMIN (BE v2 discovery — thay nhập mã hạng mù, Q2 đã trả lời).
// Lỗi 401/403/mạng ném trung thực để caller hiện trạng thái, không đoán danh sách.
export async function fetchTierList(): Promise<TierInfo[]> {
  const r = await beFetch("v1/thanh-vien/chinh-sach/hang");
  return unwrap<TierInfo[]>(r);
}

export async function openLegacyBalance(maKh: number | string): Promise<unknown> {
  const r = await beWrite("v1/quan-tri/thanh-vien/mo-dau", "POST", { maKh });
  return unwrap<unknown>(r);
}
