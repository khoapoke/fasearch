// Browser client for the candidate auth BFF. The access token never appears in
// this module, browser JSON, storage or logs; the HttpOnly cookie is server-set.

export type AuthIdentity = {
  id: number;
  username: string;
  email: string;
  role: string;
  status: string;
  createdAt: string;
};

export class AuthApiError extends Error {
  status: number;
  code: string;
  errors?: Array<{ field?: string; reason?: string }>;
  constructor(message: string, status: number, code = "AUTH_ERROR", errors?: Array<{ field?: string; reason?: string }>) {
    super(message);
    this.name = "AuthApiError";
    this.status = status;
    this.code = code;
    this.errors = errors;
  }
}

type Envelope<T> = { success?: boolean; message?: string; code?: string; identity?: T; errors?: Array<{ field?: string; reason?: string }> };

async function parse<T>(response: Response): Promise<T> {
  let payload: Envelope<T> | null = null;
  try { payload = (await response.json()) as Envelope<T>; } catch { /* non-json */ }
  if (!response.ok || payload?.success !== true || payload.identity === undefined) {
    throw new AuthApiError(
      payload?.message || "Không thể xác thực lúc này. Thử lại sau ít phút.",
      response.status || 502,
      payload?.code || "AUTH_ERROR",
      payload?.errors,
    );
  }
  return payload.identity;
}

export async function authLogin(username: string, password: string): Promise<AuthIdentity> {
  const response = await fetch("/api/customer-auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  return parse<AuthIdentity>(response);
}

export async function authRegister(input: {
  username: string;
  password: string;
  email: string;
  firstName: string;
  lastName: string;
  phoneNumber: string;
  gender: string;
}): Promise<AuthIdentity> {
  const response = await fetch("/api/customer-auth/register", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  return parse<AuthIdentity>(response);
}

export async function authMe(signal?: AbortSignal): Promise<AuthIdentity> {
  const response = await fetch("/api/customer-auth/me", { cache: "no-store", signal });
  return parse<AuthIdentity>(response);
}

export async function authLogout(): Promise<void> {
  const response = await fetch("/api/customer-auth/logout", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "{}",
  });
  if (!response.ok) {
    let message = "Không thể đăng xuất. Thử lại.";
    try { const payload = (await response.json()) as { message?: string }; if (payload.message) message = payload.message; } catch { /* non-json */ }
    throw new AuthApiError(message, response.status || 502);
  }
}

export function formatAuthDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("vi-VN", { dateStyle: "medium", timeStyle: "short" }).format(date);
}
