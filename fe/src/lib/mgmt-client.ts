// Client dùng chung cho các trang quản trị + catalog (CONTRACT §8).
// Backend giữ nguyên envelope { success, code, message, result, errors }.

export type Envelope<T> = {
  success: boolean;
  code: number;
  message: string;
  result: T;
  errors?: Array<{ field: string; reason: string }>;
};

export type Page<T> = {
  data: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
};

export async function unwrap<T>(response: Response): Promise<T> {
  let payload: Envelope<T>;
  try {
    payload = (await response.json()) as Envelope<T>;
  } catch {
    throw new Error(`Máy chủ trả về không đúng định dạng (HTTP ${response.status}).`);
  }
  if (!response.ok || !payload || typeof payload !== "object" || !("result" in payload)) {
    const reason =
      payload && typeof payload === "object" && payload.message
        ? payload.message
        : `Yêu cầu thất bại (HTTP ${response.status}).`;
    const fields =
      payload && Array.isArray(payload.errors) && payload.errors.length > 0
        ? ": " + payload.errors.map((e) => e.reason).join("; ")
        : "";
    throw new Error(reason + fields);
  }
  return payload.result;
}

export async function beFetch(path: string, init?: RequestInit): Promise<Response> {
  return fetch(`/api/be/${path}`, { cache: "no-store", ...init });
}

export async function beWrite(
  path: string,
  method: "POST" | "PATCH" | "PUT" | "DELETE",
  body?: unknown,
  signal?: AbortSignal,
): Promise<Response> {
  // Validate CSRF trước khi ghi: hết phiên/toàn cục lỗi đều chặn write sớm
  // với 401/502 trung thực, không gửi request biến dạng (parity với whWrite).
  let token: { headerName: string; token: string };
  try {
    const csrfRaw = await fetch("/api/auth/csrf", { cache: "no-store", signal });
    if (!csrfRaw.ok) {
      return Response.json(
        { success: false, code: 401, message: "Phiên đăng nhập đã hết hiệu lực. Đăng nhập lại trước khi thay đổi dữ liệu.", result: null },
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
  if (body instanceof FormData) {
    payload = body;
  } else if (body !== undefined) {
    headers["content-type"] = "application/json";
    payload = JSON.stringify(body);
  }
  return fetch(`/api/be/${path}`, { method, headers, body: payload, cache: "no-store", signal });
}

export function vnd(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === "") return "—";
  const num = typeof value === "string" ? Number(value) : value;
  if (!Number.isFinite(num)) return "—";
  return num.toLocaleString("vi-VN") + " ₫";
}

export function trangThaiTaiKhoan(status: string): string {
  if (status === "HOAT_DONG") return "Hoạt động";
  if (status === "KHOA") return "Đã khóa";
  if (status === "DA_XOA") return "Đã xóa";
  return status;
}

export function trangThaiSanPham(status: string): string {
  if (status === "DANG_BAN") return "Đang bán";
  if (status === "NGUNG_KD") return "Ngừng kinh doanh";
  return status;
}
