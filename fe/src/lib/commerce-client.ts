// Fetch wrappers cho commerce (frozen CONTRACT.md v1).
// Dùng /api/be proxy (session + CSRF giữ nguyên); giữ đúng status BE
// (401/403/404/409/502/503). Không mock fallback — lỗi mạng/parse ném Error
// để caller hiện trạng thái trung thực.

import { beFetch, beWrite, unwrap } from "./mgmt-client.ts";
import type { Cart, OrderDetail, Quote, Warehouse } from "./commerce.ts";

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

// ---- POS shared client types ----

export type PosProduct = {
  maSku: number; maSp: number; tenSp: string; mauSac: string | null; kichCo: string | null;
  maVach: string | null; donGia: number; soLuongKhaDung?: number | null;
};

export type PosCustomer = {
  maKh: number; hoTen: string; sdt: string;
  diemTichLuy?: number | null; diemGiuCho?: number | null;
  tongChiTieu?: number | null; tenHang?: string | null;
};

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
