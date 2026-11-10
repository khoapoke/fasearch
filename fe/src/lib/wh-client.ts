// Client kho (D057–D059, CONTRACT be-draft-inventory-core, reviewed da160daf4).
// Mọi response giữ nguyên status/envelope BE: 401 guest, 403 CUSTOMER/thiếu
// CSRF, 404 ID lạ, 409 xung đột (KHONG_DU_TON, XUNG_DOT_KIEM_KE,
// IDEMPOTENCY_TRUNG), 400 validation + errors[].

import { unwrap, type Page } from "./mgmt-client.ts";

export type KhoDiaDiem = {
  maKho: number;
  tenKho: string;
  diaChi: string | null;
  trangThai: string;
  laMacDinh: boolean;
};

export type TonKho = {
  maSku: number;
  maSp: number;
  mauSac: string;
  kichCo: string;
  maVach: string;
  maKho: number;
  tenKho: string;
  soLuongThuc: number;
  soLuongGiuCho: number;
  soLuongKhaDung: number;
  phienBan: number;
  nguongToiThieu: number | null;
};

export type PhieuItem = {
  maSku: number;
  soLuong: number;
  donGiaSnapshot?: number | null;
  tonCoSo?: number | null;
  phienBanCoSo?: number | null;
};

export type PhieuKho = {
  maPhieu: number;
  loai: "NHAP_NCC" | "XUAT_HUY" | "CHUYEN_KHO" | "KIEM_KE" | "CAN_BANG";
  trangThai: "BAN_NHAP" | "DA_XAC_NHAN" | "DA_HUY";
  maKhoNguon: number | null;
  maKhoDich: number | null;
  items: PhieuItem[];
  khoaTam: string;
  maPhieuLienKet: number | null;
  nhaCungCap: string | null;
  lyDo: string | null;
  nguoiTao: string | null;
  nguoiXacNhan: string | null;
  ngayTao: string | null;
  ngayXacNhan: string | null;
};

export type CanhBao = {
  maTb: number;
  maSku: number;
  maKho: number;
  nguong: number;
  tonKichHoat: number;
  tonPhucHoi: number | null;
  dangHoatDong: boolean;
  daDoc: boolean;
  batDau: string;
  ketThuc: string | null;
};

export type BienDong = {
  maBd: number;
  maPhieu: number;
  maSku: number;
  maKho: number;
  tonTruoc: number;
  tonSau: number;
  delta: number;
  loai: string;
  thoiGian: string;
};

export async function whFetch(path: string, init?: RequestInit): Promise<Response> {
  return fetch(`/api/wh/${path}`, { cache: "no-store", ...init });
}

export async function whWrite(
  path: string,
  method: "POST" | "PATCH" | "PUT" | "DELETE",
  body?: unknown,
): Promise<Response> {
  // Validate CSRF response trước khi ghi: hết phiên/toàn cục lỗi đều chặn
  // write sớm với 401/502 trung thực, không gửi request biến dạng.
  let token: { headerName: string; token: string };
  try {
    const csrfRaw = await fetch("/api/auth/csrf", { cache: "no-store" });
    if (!csrfRaw.ok) {
      return Response.json(
        { success: false, code: 401, message: "Phiên đăng nhập đã hết hiệu lực. Đăng nhập lại trước khi ghi kho.", result: null },
        { status: 401 },
      );
    }
    const csrf = (await csrfRaw.json()) as {
      success?: boolean;
      result?: { headerName?: unknown; token?: unknown };
    };
    if (!csrf || csrf.success !== true || typeof csrf.result?.headerName !== "string" || typeof csrf.result?.token !== "string") {
      return Response.json(
        { success: false, code: 502, message: "Không lấy được mã CSRF. Thử lại.", result: null },
        { status: 502 },
      );
    }
    token = { headerName: csrf.result.headerName, token: csrf.result.token };
  } catch {
    return Response.json(
      { success: false, code: 502, message: "Không kết nối được máy chủ xác thực.", result: null },
      { status: 502 },
    );
  }
  const headers: Record<string, string> = { [token.headerName]: token.token };
  let payload: BodyInit | undefined;
  if (body !== undefined) {
    headers["content-type"] = "application/json";
    payload = JSON.stringify(body);
  }
  return fetch(`/api/wh/${path}`, { method, headers, body: payload, cache: "no-store" });
}

export type WhError = { status: number; code: string; message: string; errors: Array<{ field: string; reason: string }> };

export async function whReadError(response: Response): Promise<WhError> {
  let code = "";
  let message = `Yêu cầu thất bại (HTTP ${response.status}).`;
  let errors: WhError["errors"] = [];
  try {
    const payload = (await response.json()) as { code?: number; message?: string; errors?: WhError["errors"] };
    if (payload.message) message = payload.message;
    if (Array.isArray(payload.errors)) errors = payload.errors;
  } catch {
    /* non-JSON upstream body */
  }
  if (response.status === 401) {
    code = "GUEST";
    message = "Phiên đăng nhập đã hết hiệu lực. Đăng nhập STAFF/ADMIN để quản lý kho.";
  } else if (response.status === 403) {
    code = "FORBIDDEN";
    message = "Tài khoản của bạn không có quyền kho (cần STAFF/ADMIN).";
  } else if (response.status === 409) {
    // Xung đột tồn/kiểm kê/trùng khóa: dữ liệu đã đổi sau lần đọc. Không tự
    // retry mutation; người dùng tải lại rồi đếm/chốt lại.
    code = "CONFLICT";
    message = `${message} Dữ liệu đã thay đổi — tải lại danh sách/kiểm lại tồn rồi thao tác tiếp, không gửi lại tự động.`;
  }
  return { status: response.status, code, message, errors };
}

export function loaiPhieuLabel(loai: PhieuKho["loai"]): string {
  if (loai === "NHAP_NCC") return "Nhập NCC";
  if (loai === "XUAT_HUY") return "Xuất hủy";
  if (loai === "CHUYEN_KHO") return "Chuyển kho";
  if (loai === "KIEM_KE") return "Kiểm kê";
  return "Cân bằng";
}

export function trangThaiPhieuLabel(t: PhieuKho["trangThai"]): string {
  if (t === "BAN_NHAP") return "Bản nháp";
  if (t === "DA_XAC_NHAN") return "Đã xác nhận";
  return "Đã hủy";
}

/** Khóa tạm client: `stitch29-<epoch36>-<rand>` (8..64, [A-Za-z0-9_-]). */
export function newKhoaTam(): string {
  const rand = Math.random().toString(36).slice(2, 8);
  return `stitch29-${Date.now().toString(36)}-${rand}`;
}

export type { Page };
export { unwrap };
