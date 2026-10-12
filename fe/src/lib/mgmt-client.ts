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
): Promise<Response> {
  const csrf = await fetch("/api/auth/csrf", { cache: "no-store" }).then((r) => r.json());
  const token = (csrf as Envelope<{ headerName: string; token: string }>).result;
  const headers: Record<string, string> = { [token.headerName]: token.token };
  let payload: BodyInit | undefined;
  if (body instanceof FormData) {
    payload = body;
  } else if (body !== undefined) {
    headers["content-type"] = "application/json";
    payload = JSON.stringify(body);
  }
  return fetch(`/api/be/${path}`, { method, headers, body: payload, cache: "no-store" });
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
