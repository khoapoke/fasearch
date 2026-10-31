export type PromotionCode = { maVoucher: number; maKm: number; maCode: string; soLuongPhatHanh: number | null; daSuDung: number; soLuongGiuCho: number; trangThai: "ACTIVE" };
export type Campaign = { maKm: number; tenCtkm: string; loaiGiam: "PHAN_TRAM" | "SO_TIEN"; giaTriGiam: number; ngayBatDau: string; ngayKetThuc: string; dieuKienApDung: string | null; trangThai: "HOAT_DONG" | "TAM_DUNG"; phienBan: number; maSpApDung: number[]; codes: PromotionCode[] };
export type CampaignPage = { data: Campaign[]; page: number; size: number; totalElements: number; totalPages: number; isLast: boolean };
export type CampaignUpdate = { phienBan: number; tenCtkm?: string; loaiGiam?: Campaign["loaiGiam"]; giaTriGiam?: number; ngayBatDau?: string; ngayKetThuc?: string; dieuKienApDung?: string; maSpApDung?: number[]; trangThai?: Campaign["trangThai"] };

export class PromotionError extends Error {
  status: number;
  code: string;
  constructor(message: string, status: number, code: string) { super(message); this.name = "PromotionError"; this.status = status; this.code = code; }
}

const invalidResponse = () => new PromotionError("Phản hồi khuyến mãi không đúng định dạng.", 502, "INVALID_RESPONSE");
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw invalidResponse();
  return value as Record<string, unknown>;
}
function integer(value: unknown, min = 0): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < min) throw invalidResponse();
  return value;
}
function normalizeCode(raw: unknown): PromotionCode {
  const value = object(raw);
  if (value.trangThai !== "ACTIVE" || typeof value.maCode !== "string") throw invalidResponse();
  const quota = value.soLuongPhatHanh === null ? null : integer(value.soLuongPhatHanh, 1);
  return { maVoucher: integer(value.maVoucher, 1), maKm: integer(value.maKm, 1), maCode: value.maCode, soLuongPhatHanh: quota, daSuDung: integer(value.daSuDung), soLuongGiuCho: integer(value.soLuongGiuCho), trangThai: "ACTIVE" };
}
export function normalizeCampaign(raw: unknown): Campaign {
  const value = object(raw);
  if (typeof value.tenCtkm !== "string" || (value.loaiGiam !== "PHAN_TRAM" && value.loaiGiam !== "SO_TIEN") || (value.trangThai !== "HOAT_DONG" && value.trangThai !== "TAM_DUNG") || typeof value.ngayBatDau !== "string" || typeof value.ngayKetThuc !== "string" || (value.dieuKienApDung !== null && typeof value.dieuKienApDung !== "string") || !Array.isArray(value.maSpApDung) || !value.maSpApDung.every((id) => Number.isSafeInteger(id) && (id as number) > 0) || !Array.isArray(value.codes)) throw invalidResponse();
  const giaTriGiam = value.giaTriGiam;
  if (typeof giaTriGiam !== "number" || !Number.isFinite(giaTriGiam) || giaTriGiam <= 0 || (value.loaiGiam === "PHAN_TRAM" && giaTriGiam > 100)) throw invalidResponse();
  return { maKm: integer(value.maKm, 1), tenCtkm: value.tenCtkm, loaiGiam: value.loaiGiam, giaTriGiam, ngayBatDau: value.ngayBatDau, ngayKetThuc: value.ngayKetThuc, dieuKienApDung: value.dieuKienApDung, trangThai: value.trangThai, phienBan: integer(value.phienBan), maSpApDung: value.maSpApDung as number[], codes: value.codes.map(normalizeCode) };
}

async function call<T>(path: string, method = "GET", body?: unknown): Promise<T> {
  const response = await fetch(path, {
    method, cache: "no-store",
    ...(body === undefined ? {} : { headers: { "content-type": "application/json" }, body: JSON.stringify(body) }),
  });
  let envelope: { success?: boolean; code?: number | string; message?: string; result?: unknown } | null = null;
  try { envelope = await response.json(); } catch { /* non-JSON response */ }
  if (!response.ok || envelope?.success !== true || envelope.result === undefined) {
    throw new PromotionError(envelope?.message || "Không thể kết nối máy chủ khuyến mãi.", response.status || 502, envelope?.code === undefined ? "PROMOTION_ERROR" : String(envelope.code));
  }
  return envelope.result as T;
}

export async function fetchCampaigns(query: string): Promise<CampaignPage> {
  const page = await call<{ content: Campaign[]; pageNumber: number; pageSize: number; totalElements: number; totalPages: number; last: boolean }>(`/api/admin/promotions?${query}`);
  if (!Array.isArray(page.content) || !Number.isInteger(page.pageNumber) || !Number.isInteger(page.pageSize) || !Number.isInteger(page.totalElements) || !Number.isInteger(page.totalPages) || typeof page.last !== "boolean") throw new PromotionError("Phản hồi danh sách khuyến mãi không đúng định dạng.", 502, "INVALID_RESPONSE");
  return { data: page.content.map(normalizeCampaign), page: page.pageNumber, size: page.pageSize, totalElements: page.totalElements, totalPages: page.totalPages, isLast: page.last };
}

export async function fetchCampaign(id: number): Promise<Campaign> { return normalizeCampaign(await call(`/api/admin/promotions/${id}`)); }
export async function createCampaign(body: Omit<CampaignUpdate, "phienBan" | "trangThai"> & { tenCtkm: string; loaiGiam: Campaign["loaiGiam"]; giaTriGiam: number; ngayBatDau: string; ngayKetThuc: string }): Promise<Campaign> { return normalizeCampaign(await call("/api/admin/promotions", "POST", body)); }
export async function updateCampaign(id: number, body: CampaignUpdate): Promise<Campaign> { return normalizeCampaign(await call(`/api/admin/promotions/${id}`, "PUT", body)); }
export async function addCampaignCode(id: number, body: { maCode: string; soLuongPhatHanh: number | null }): Promise<PromotionCode> { return normalizeCode(await call(`/api/admin/promotions/${id}/codes`, "POST", body)); }
