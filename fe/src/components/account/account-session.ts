// Shared account session helpers (client). Thin fetch wrappers; the backend
// stays authoritative for validation and auth decisions.

export type Csrf = { header: string; token: string };

export async function fetchCsrf(): Promise<Csrf> {
  const response = await fetch("/api/auth/csrf", { cache: "no-store" });
  if (!response.ok) throw new Error("Không thể bắt đầu phiên. Hãy thử lại.");
  const payload = (await response.json()) as { header_name: string; token: string };
  return { header: payload.header_name, token: payload.token };
}

export type AccountProfile = {
  username: string;
  email: string;
  display_name: string | null;
};

export async function readOwnProfile(): Promise<AccountProfile | null> {
  const response = await fetch("/api/auth/profile", { cache: "no-store" });
  if (response.status === 401) return null;
  if (!response.ok) throw new Error("Không thể tải thông tin tài khoản.");
  return (await response.json()) as AccountProfile;
}

export async function logout(): Promise<void> {
  const csrf = await fetchCsrf();
  const response = await fetch("/api/auth/logout", {
    method: "POST",
    headers: { [csrf.header]: csrf.token },
  });
  if (!response.ok) throw new Error("Không thể đăng xuất. Hãy thử lại.");
}
