// Shared account session helpers (client). Thin fetch wrappers; the backend
// stays authoritative for validation and auth decisions. All payloads use the
// BE ApiResponse envelope: { success, code, message, result, errors }.

export type Csrf = { header: string; token: string };

type Envelope<T> = {
  success: boolean;
  code: number;
  message: string;
  result: T;
  errors?: Array<{ field: string; reason: string }>;
};

function unwrap<T>(payload: unknown): T {
  const envelope = payload as Envelope<T>;
  if (!envelope || typeof envelope !== "object" || !("result" in envelope)) {
    throw new Error("Định dạng phản hồi không đúng.");
  }
  return envelope.result;
}

export async function fetchCsrf(): Promise<Csrf> {
  const response = await fetch("/api/auth/csrf", { cache: "no-store" });
  if (!response.ok) throw new Error("Không thể bắt đầu phiên. Hãy thử lại.");
  const payload = (await response.json()) as Envelope<{ headerName: string; token: string }>;
  const result = unwrap<{ headerName: string; token: string }>(payload);
  return { header: result.headerName, token: result.token };
}

export type AccountIdentity = {
  id: number;
  username: string;
  email: string;
  role: string;
  authenticated: boolean;
};

export type CustomerProfile = {
  id: number;
  hoTen: string;
  sdt: string;
  gioiTinh: string | null;
  ngaySinh: string | null;
  diaChi: string | null;
  email: string | null;
  diemTichLuy: number;
  maHang: number | null;
  tenHang: string | null;
  maTk: number | null;
};

export type OwnProfile = {
  account: AccountIdentity;
  customer: CustomerProfile | null;
  hasCustomerProfile: boolean;
};

export async function readOwnIdentity(): Promise<AccountIdentity | null> {
  const response = await fetch("/api/auth/me", { cache: "no-store" });
  if (response.status === 401) return null;
  if (!response.ok) throw new Error("Không thể tải thông tin phiên.");
  return unwrap<AccountIdentity>(await response.json());
}

export async function readOwnProfile(): Promise<OwnProfile | null> {
  const response = await fetch("/api/auth/profile", { cache: "no-store" });
  if (response.status === 401) return null;
  if (!response.ok) throw new Error("Không thể tải thông tin tài khoản.");
  return unwrap<OwnProfile>(await response.json());
}

export async function logout(): Promise<void> {
  const csrf = await fetchCsrf();
  const response = await fetch("/api/auth/logout", {
    method: "POST",
    headers: { [csrf.header]: csrf.token },
  });
  if (!response.ok) throw new Error("Không thể đăng xuất. Hãy thử lại.");
}
