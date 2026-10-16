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

export async function quoteCart(maKho: number, phienBan: number): Promise<Quote> {
  const r = await beWrite("v1/gio-hang/quote", "POST", { maKho, phienBan });
  return unwrap<Quote>(r);
}

export async function createOnlineOrder(body: {
  khoaTam: string; maKho: number; phienBanGio: number; tongThanhToanDuKien: number;
  nguoiNhan: string; sdtNhan: string; diaChiGiao: string; ghiChu?: string;
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
  maKh: number; hoTen: string; sdt: string; hang?: string | null; diem?: number | null;
};

export async function posFindCustomer(sdt: string): Promise<PosCustomer | null> {
  const r = await beFetch(`v1/pos/khach-hang?sdt=${encodeURIComponent(sdt)}`);
  if (r.status === 404) return null;
  return unwrap<PosCustomer>(r);
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

export async function posQuote(id: number, phienBan: number): Promise<PosQuote> {
  const r = await beWrite(`v1/pos/don-hang/${encodeURIComponent(String(id))}/quote`, "POST", { phienBan });
  return unwrap<PosQuote>(r);
}

export async function posPay(id: number, body: {
  khoaTam: string; phienBan: number; tongThanhToanDuKien: number; tienKhachDua: number;
}): Promise<PosReceipt> {
  const r = await beWrite(`v1/pos/don-hang/${encodeURIComponent(String(id))}/thanh-toan`, "POST", body);
  return unwrap<PosReceipt>(r);
}

export async function posCancel(id: number, body: { khoaTam: string; phienBan: number; lyDo: string }): Promise<PosDraft> {
  const r = await beWrite(`v1/pos/don-hang/${encodeURIComponent(String(id))}/huy`, "POST", body);
  return unwrap<PosDraft>(r);
}

export async function fetchReceipt(id: string | number): Promise<PosReceipt | OrderDetail> {
  const r = await beFetch(`v1/hoa-don/${encodeURIComponent(String(id))}`);
  return unwrap<PosReceipt | OrderDetail>(r);
}
