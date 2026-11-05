// Browser client for the candidate auth BFF. The access token never appears in
// this module, browser JSON, storage or logs; the HttpOnly cookie is server-set.

export type AuthIdentity = {
  id: number;
  username: string;
  email: string;
  role: string;
  status: string;
  createdAt: string;
  /** true khi tai khoan da xac thuc email (BE tra tu V21). */
  emailVerified?: boolean;
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

const ATTEMPT_COOKIE = "fasearch-auth-current-3139";
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
  const result = parse<AuthIdentity>(response);
  const { clearFavoriteCache } = await import("./favorites-store");
  clearFavoriteCache();
  // prefetch favorite ids for the new session (best-effort)
  const { loadFavoriteIds } = await import("./favorites-store");
  void loadFavoriteIds().catch(() => {});
  return result;
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
  const identity = await parse<AuthIdentity>(response);
  invalidateAuthMemory();
  memory = { kind: "authenticated", identity };
  return identity;
}

// R4-G: trạng thái auth cấp module, ba giá trị: unknown | guest | authenticated.
// Mỗi trang tự bọc StorefrontShell nên header remount khi điều hướng nội bộ; nếu
// remount lại luôn bắt đầu ở "unknown" thì nhãn nháy "Đăng nhập" mỗi lần đổi route
// — đúng lỗi người dùng báo. Vì vậy nhớ cả trường hợp đã biết là guest (401).
//
// An toàn:
// - Chỉ sống trong tab hiện tại (biến module), không SSR cache, không localStorage.
// - Không dùng để cấp quyền: BE vẫn là nguồn quyết định cho mọi request.
// - Mỗi lần login/logout/đổi tài khoản tăng `authGeneration`; kết quả /me của
//   generation cũ bị bỏ, nên một request chậm không thể "hồi sinh" identity cũ.
type AuthMemory =
  | { kind: "unknown" }
  | { kind: "guest" }
  | { kind: "authenticated"; identity: AuthIdentity };

let memory: AuthMemory = { kind: "unknown" };
let inflightMe: Promise<AuthIdentity> | null = null;
let authGeneration = 0;

/** Trạng thái đã biết gần nhất trong tab (unknown khi chưa có kết quả nào). */
export function peekAuthMemory(): AuthMemory {
  return memory;
}

/** Identity đã xác thực gần nhất, hoặc null (dùng cho code cũ). */
export function peekAuthIdentity(): AuthIdentity | null {
  return memory.kind === "authenticated" ? memory.identity : null;
}

/** Gọi sau login/logout/đổi tài khoản: bỏ mọi kết quả /me đang bay của phiên cũ. */
export function invalidateAuthMemory(): void {
  authGeneration += 1;
  memory = { kind: "unknown" };
  inflightMe = null;
}

/** Tương thích chỗ gọi cũ. */
export function clearAuthIdentityCache(): void {
  invalidateAuthMemory();
}

export async function authMe(signal?: AbortSignal): Promise<AuthIdentity> {
  ensureAuthAttempt();
  const generation = authGeneration;
  // Gộp các consumer đang chờ cùng một lần /me; KHÔNG truyền AbortSignal của một
  // caller vào request dùng chung (huỷ của người này sẽ đầu độc người khác).
  if (!inflightMe) {
    inflightMe = (async () => {
      const response = await fetch("/api/customer-auth/me", { cache: "no-store" });
      if (response.status === 401) {
        if (generation === authGeneration) memory = { kind: "guest" };
        throw await parse<AuthIdentity>(response);
      }
      const identity = await parse<AuthIdentity>(response);
      if (generation === authGeneration) memory = { kind: "authenticated", identity };
      return identity;
    })().finally(() => {
      if (inflightMe) inflightMe = null;
    });
  }
  const shared = inflightMe;
  if (!signal) return shared;
  // Caller có AbortSignal riêng: chỉ ngắt phần chờ của họ, không huỷ request chung.
  return Promise.race([
    shared,
    new Promise<AuthIdentity>((_, reject) => {
      const abortError = () => { const e = new Error("Aborted"); e.name = "AbortError"; return e; };
      if (signal.aborted) reject(abortError());
      else signal.addEventListener("abort", () => reject(abortError()), { once: true });
    }),
  ]);
}

export async function authLogout(signal?: AbortSignal): Promise<void> {
  ensureAuthAttempt();
  const { clearFavoriteCache } = await import("./favorites-store");
  clearFavoriteCache();
  const response = await fetch("/api/customer-auth/logout", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "{}",
    signal,
  });
  invalidateAuthMemory();
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

// Quen mat khau / xac thuc email: khong co identity, chi can success/message.
// Token dang nhap khong bao gio xuat hien o browser; BFF giu HttpOnly cookie.

type ActionEnvelope = { success?: boolean; message?: string; code?: string; errors?: Array<{ field?: string; reason?: string }> };

async function authAction(path: string, body: unknown, signal?: AbortSignal): Promise<string> {
  const response = await fetch(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
  let payload: ActionEnvelope | null = null;
  try { payload = (await response.json()) as ActionEnvelope; } catch { /* non-json */ }
  if (!response.ok || payload?.success !== true) {
    throw new AuthApiError(
      payload?.message || "Không thể thực hiện lúc này. Thử lại sau ít phút.",
      response.status || 502,
      payload?.code || "AUTH_ERROR",
      payload?.errors,
    );
  }
  return payload.message || "Đã ghi nhận yêu cầu.";
}

/** Gui lien ket dat lai mat khau (tra loi giong nhau du email co ton tai hay khong). */
export function requestPasswordReset(email: string, signal?: AbortSignal): Promise<string> {
  return authAction("/api/customer-auth/password/forgot", { email }, signal);
}

/** Dat mat khau moi bang token tu email. */
export function resetPassword(token: string, newPassword: string, signal?: AbortSignal): Promise<string> {
  return authAction("/api/customer-auth/password/reset", { token, newPassword }, signal);
}

/** Gui lai email xac thuc cho tai khoan dang dang nhap. */
export function requestVerificationEmail(signal?: AbortSignal): Promise<string> {
  ensureAuthAttempt();
  return authAction("/api/customer-auth/email/verification-request", {}, signal);
}

/** Xac nhan token verify email tu lien ket trong email. */
export function verifyEmail(token: string, signal?: AbortSignal): Promise<string> {
  return authAction("/api/customer-auth/email/verify", { token }, signal);
}
