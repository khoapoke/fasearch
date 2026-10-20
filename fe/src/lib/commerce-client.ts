// Fetch wrappers cho commerce/POS (frozen CONTRACT.md v1).
// Dùng /api/be proxy (session + CSRF giữ nguyên); giữ đúng status BE
// (401/403/404/409/502/503). Không mock fallback — lỗi mạng/parse ném Error
// để caller hiện trạng thái trung thực.

import { beFetch, beWrite, unwrap } from "./mgmt-client.ts";
import type {
  Cart, OrderDetail, PosDraft, PosQuote, PosReceipt, Quote, Warehouse,
} from "./commerce.ts";

export type Paged<T> = {
  data: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
};

export async function fetchCart(): Promise<Cart> {
  const r = await beFetch("v1/gio-hang");
  return unwrap<Cart>(r);
}

export async function putCartItem(maSku: number, soLuong: number, phienBan: number): Promise<Cart> {
  const r = await beWrite("v1/gio-hang/items/" + encodeURIComponent(String(maSku)), "PUT", { soLuong, phienBan });
  return unwrap<Cart>(r);
}

export async function deleteCartItem(maSku: number, phienBan: number): Promise<Cart> {
  const r = await beWrite(
    `v1/gio-hang/items/${encodeURIComponent(String(maSku))}?phienBan=${encodeURIComponent(String(phienBan))}`,
    "DELETE",
  );
  return unwrap<Cart>(r);
}

export async function fetchWarehouses(): Promise<Warehouse[]> {
  const r = await beFetch("v1/catalog/kho-phuc-vu");
  return unwrap<Warehouse[]>(r);
}

export type QuoteBenefitsInput = { voucherCode?: string | null; diemSuDung?: number | null; maChinhSach?: number | null; phienBanChinhSach?: number | null };

export async function quoteCart(maKho: number, phienBan: number, benefits?: QuoteBenefitsInput): Promise<Quote> {
  const r = await beWrite("v1/gio-hang/quote", "POST", {
    maKho,
    phienBan,
    ...(benefits?.voucherCode ? { voucherCode: benefits.voucherCode } : {}),
    ...(benefits?.diemSuDung !== undefined && benefits.diemSuDung !== null ? { diemSuDung: benefits.diemSuDung } : {}),
  });
  return unwrap<Quote>(r);
}

export async function createOnlineOrder(body: {
  khoaTam: string; maKho: number; phienBanGio: number; tongThanhToanDuKien: number;
  nguoiNhan: string; sdtNhan: string; diaChiGiao: string; ghiChu?: string;
  voucherCode?: string | null; diemSuDung?: number | null;
  maChinhSach?: number | null; phienBanChinhSach?: number | null;
}): Promise<{ order: OrderDetail; replay: boolean; status: number }> {
  const r = await beWrite("v1/don-hang", "POST", body);
  const order = await unwrap<OrderDetail>(r);
  return { order, replay: r.status === 200, status: r.status };
}

export async function fetchOwnOrders(query: string): Promise<Paged<OrderDetail>> {
  const r = await beFetch(`v1/don-hang?${query}`);
  return unwrap<Paged<OrderDetail>>(r);
}

export async function fetchOwnOrder(id: string | number): Promise<OrderDetail> {
  const r = await beFetch(`v1/don-hang/${encodeURIComponent(String(id))}`);
  return unwrap<OrderDetail>(r);
}

export async function cancelOwnOrder(id: string | number, body: {
  khoaTam: string; phienBan: number; lyDo: string;
}): Promise<OrderDetail> {
  const r = await beWrite(`v1/don-hang/${encodeURIComponent(String(id))}/huy`, "POST", body);
  return unwrap<OrderDetail>(r);
}

// ---- Staff ----

export async function fetchStaffOrders(query: string): Promise<Paged<OrderDetail>> {
  const r = await beFetch(`v1/quan-tri/don-hang?${query}`);
  return unwrap<Paged<OrderDetail>>(r);
}

export async function fetchStaffOrder(id: string | number): Promise<OrderDetail> {
  const r = await beFetch(`v1/quan-tri/don-hang/${encodeURIComponent(String(id))}`);
  return unwrap<OrderDetail>(r);
}

export async function staffTransition(id: string | number, body: {
  khoaTam: string; phienBan: number; trangThaiDich: string; ghiChu?: string;
}): Promise<OrderDetail> {
  const r = await beWrite(`v1/quan-tri/don-hang/${encodeURIComponent(String(id))}/trang-thai`, "POST", body);
  return unwrap<OrderDetail>(r);
}

export async function staffCancel(id: string | number, body: {
  khoaTam: string; phienBan: number; lyDo: string;
}): Promise<OrderDetail> {
  const r = await beWrite(`v1/quan-tri/don-hang/${encodeURIComponent(String(id))}/huy`, "POST", body);
  return unwrap<OrderDetail>(r);
}

export async function staffCompleteCod(id: string | number, body: {
  khoaTam: string; phienBan: number; soTienDaThu: number; xacNhanDaGiao: true;
}): Promise<OrderDetail> {
  const r = await beWrite(`v1/quan-tri/don-hang/${encodeURIComponent(String(id))}/hoan-thanh-cod`, "POST", body);
  return unwrap<OrderDetail>(r);
}

// ---- POS ----

export type PosProduct = {
  maSku: number; maSp: number; tenSp: string; mauSac: string | null; kichCo: string | null;
  maVach: string | null; donGia: number; soLuongKhaDung?: number | null;
};

export async function posSearchProducts(params: { q: string; maKho: number; page?: number; size?: number }): Promise<Paged<PosProduct>> {
  const q = new URLSearchParams({ q: params.q, maKho: String(params.maKho) });
  q.set("page", String(params.page ?? 0));
  q.set("size", String(Math.min(100, Math.max(1, params.size ?? 20))));
  const r = await beFetch(`v1/pos/san-pham?${q.toString()}`);
  return unwrap<Paged<PosProduct>>(r);
}

export type PosCustomer = {
  maKh: number; hoTen: string; sdt: string;
  diemTichLuy?: number | null; diemGiuCho?: number | null;
  tongChiTieu?: number | null; tenHang?: string | null;
};

type RawPosCustomer = {
  maKh?: number | null; id?: number | null; hoTen: string; sdt: string;
  diemTichLuy?: number | null; diemGiuCho?: number | null;
  tongChiTieu?: number | null; tenHang?: string | null;
};

export async function posFindCustomer(sdt: string): Promise<PosCustomer | null> {
  const r = await beFetch(`v1/pos/khach-hang?sdt=${encodeURIComponent(sdt)}`);
  if (r.status === 404) return null;
  const raw = await unwrap<RawPosCustomer | RawPosCustomer[]>(r);
  const first = Array.isArray(raw) ? raw[0] : raw;
  if (!first) return null;
  const maKh = first.maKh ?? first.id ?? null;
  if (maKh === null || maKh === undefined) return null;
  return {
    maKh, hoTen: first.hoTen, sdt: first.sdt,
    diemTichLuy: first.diemTichLuy ?? null, diemGiuCho: first.diemGiuCho ?? null,
    tongChiTieu: first.tongChiTieu ?? null, tenHang: first.tenHang ?? null,
  };
}

export async function posCreateDraft(body: { khoaTam: string; maKho: number; maKh?: number | null }): Promise<PosDraft> {
  const r = await beWrite("v1/pos/don-hang", "POST", body);
  return unwrap<PosDraft>(r);
}

export async function posListDrafts(): Promise<Paged<PosDraft>> {
  const r = await beFetch("v1/pos/don-hang?trangThai=TAM_LUU&page=0&size=20");
  return unwrap<Paged<PosDraft>>(r);
}

export async function posGetDraft(id: number): Promise<PosDraft> {
  const r = await beFetch(`v1/pos/don-hang/${encodeURIComponent(String(id))}`);
  return unwrap<PosDraft>(r);
}

export async function posPutItems(id: number, body: { phienBan: number; items: Array<{ maSku: number; soLuong: number }> }): Promise<PosDraft> {
  const r = await beWrite(`v1/pos/don-hang/${encodeURIComponent(String(id))}/items`, "PUT", body);
  return unwrap<PosDraft>(r);
}

export async function posSetCustomer(id: number, body: { phienBan: number; maKh?: number | null }): Promise<PosDraft> {
  const r = await beWrite(`v1/pos/don-hang/${encodeURIComponent(String(id))}/khach-hang`, "PATCH", body);
  return unwrap<PosDraft>(r);
}

export async function posQuote(id: number, phienBan: number, benefits?: QuoteBenefitsInput): Promise<PosQuote> {
  const r = await beWrite(`v1/pos/don-hang/${encodeURIComponent(String(id))}/quote`, "POST", {
    phienBan,
    ...(benefits?.voucherCode ? { voucherCode: benefits.voucherCode } : {}),
    ...(benefits?.diemSuDung !== undefined && benefits.diemSuDung !== null ? { diemSuDung: benefits.diemSuDung } : {}),
  });
  return unwrap<PosQuote>(r);
}

/**
 * Chuẩn hóa kết quả thu tiền POS: BE có thể trả phẳng
 * `{...order, maHoaDon, tienThua}` hoặc lồng `{donHang: {...order},
 * maHoaDon, tienThua}`. Không đoán field khác; thiếu order/items thật thì ném
 * lỗi định dạng để caller hiện trạng thái trung thực thay vì crash render.
 */
export function normalizePosReceipt(raw: unknown): PosReceipt {
  const root = (raw ?? {}) as Record<string, unknown>;
  const order = (root.donHang ?? root) as Record<string, unknown>;
  if (!order || typeof order !== 'object' || !Array.isArray(order.items)) {
    throw new Error('Máy chủ trả về biên lai thiếu dòng hàng. Thử tải lại biên lai.');
  }
  const receipt = { ...order } as Record<string, unknown>;
  if (receipt.maHoaDon === undefined || receipt.maHoaDon === null) receipt.maHoaDon = root.maHoaDon ?? '';
  if (receipt.tienThua === undefined || receipt.tienThua === null) receipt.tienThua = root.tienThua ?? 0;
  return receipt as unknown as PosReceipt;
}

export async function posPay(id: number, body: {
  khoaTam: string; phienBan: number; tongThanhToanDuKien: number; tienKhachDua: number;
  voucherCode?: string | null; diemSuDung?: number | null;
  maChinhSach?: number | null; phienBanChinhSach?: number | null;
}): Promise<PosReceipt> {
  const r = await beWrite(`v1/pos/don-hang/${encodeURIComponent(String(id))}/thanh-toan`, "POST", body);
  return normalizePosReceipt(await unwrap<unknown>(r));
}

export async function posCancel(id: number, body: { khoaTam: string; phienBan: number; lyDo: string }): Promise<PosDraft> {
  const r = await beWrite(`v1/pos/don-hang/${encodeURIComponent(String(id))}/huy`, "POST", body);
  return unwrap<PosDraft>(r);
}

export async function fetchReceipt(id: string | number): Promise<PosReceipt | OrderDetail> {
  const r = await beFetch(`v1/hoa-don/${encodeURIComponent(String(id))}`);
  return unwrap<PosReceipt | OrderDetail>(r);
}

/**
 * Gọi lại một lần khi API trả 401 ngay sau khi đăng nhập: phiên có thể chưa
 * được ghi lúc request đầu tiên (BE đang sửa phần lưu session). Chỉ retry
 * đúng một lần, giữ nguyên mọi lỗi khác.
 */
export async function withSessionRetry<T>(call: () => Promise<T>): Promise<T> {
  try {
    return await call();
  } catch (e) {
    if ((e as { status?: number })?.status !== 401) throw e;
    await new Promise((r) => setTimeout(r, 300));
    return call();
  }
}
