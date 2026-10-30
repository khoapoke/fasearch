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

const ATTEMPT_COOKIE = "fasearch-auth-current-3127";
const ATTEMPT_PATTERN = /^[A-Za-z0-9-]{16,80}$/;

function readCookie(name: string): string | null {
  const prefix = `${name}=`;
  const item = document.cookie.split(";").map((part) => part.trim()).find((part) => part.startsWith(prefix));
  if (!item) return null;
  try { return decodeURIComponent(item.slice(prefix.length)); } catch { return null; }
}

function writeAttemptCookie(attempt: string): void {
  const secure = location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${ATTEMPT_COOKIE}=${attempt}; Path=/; Max-Age=604800; SameSite=Lax${secure}`;
}

// Login/register rotate the pointer before sending, never after a response.
export function rotateAuthAttempt(): string | null {
  if (typeof document === "undefined") return null;
  const attempt = crypto.randomUUID();
  writeAttemptCookie(attempt);
  return attempt;
}

// /me and logout must read the pointer as it existed when the request starts.
export function ensureAuthAttempt(): string | null {
  if (typeof document === "undefined") return null;
  const current = readCookie(ATTEMPT_COOKIE);
  return current && ATTEMPT_PATTERN.test(current) ? current : null;
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

export function isAuthAbort(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

export async function authLogin(username: string, password: string, signal?: AbortSignal): Promise<AuthIdentity> {
  rotateAuthAttempt();
  const response = await fetch("/api/customer-auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ username, password }),
    signal,
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
}, signal?: AbortSignal): Promise<AuthIdentity> {
  rotateAuthAttempt();
  const response = await fetch("/api/customer-auth/register", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
    signal,
  });
  return parse<AuthIdentity>(response);
}

export async function authMe(signal?: AbortSignal): Promise<AuthIdentity> {
  ensureAuthAttempt();
  const response = await fetch("/api/customer-auth/me", { cache: "no-store", signal });
  return parse<AuthIdentity>(response);
}

export async function authLogout(signal?: AbortSignal): Promise<void> {
  ensureAuthAttempt();
  const response = await fetch("/api/customer-auth/logout", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "{}",
    signal,
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
