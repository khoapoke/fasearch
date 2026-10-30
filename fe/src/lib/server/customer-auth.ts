import { NextRequest, NextResponse } from "next/server";

// Candidate-only D060 transport: JWT stays server-side in an HttpOnly cookie.
// No token/password logging, no generic proxy, no legacy auth fallback.

export const AUTH_COOKIE = "fasearch-auth-pilot-3129";
export const AUTH_ATTEMPT_COOKIE = "fasearch-auth-current-3129";
const ATTEMPT_PATTERN = /^[A-Za-z0-9-]{16,80}$/;
const MAX_COOKIE_AGE = 7 * 24 * 60 * 60;

// The browser keeps one non-secret pointer to the auth attempt it currently
// owns. Each login/register rotates that pointer before its request; the
// HttpOnly JWT cookie name is namespaced by the attempt. A slower response can
// still set its old namespaced cookie, but /me and logout only read/clear the
// pointer's attempt, so a stale response cannot replace or delete the newer
// credential. Orphaned old auth cookies expire normally and are never selected.

export type SafeIdentity = {
  id: number;
  username: string;
  email: string;
  role: string;
  status: string;
  createdAt: string;
};

type Envelope<T> = { success?: boolean; code?: number; message?: string; result?: T; errors?: Array<{ field?: string; reason?: string }> };

function backendUrl(): string {
  const value = process.env.FASEARCH_CUSTOMER_AUTH_BACKEND_URL;
  if (!value) throw new Error("auth backend not configured");
  return value.replace(/\/+$/, "");
}

function trustedOrigin(): string {
  const value = process.env.FASEARCH_AUTH_PILOT_ORIGIN;
  if (!value) throw new Error("auth origin not configured");
  return value.replace(/\/+$/, "");
}

export function authError(message: string, status: number, code = "AUTH_ERROR", errors?: Array<{ field?: string; reason?: string }>) {
  return NextResponse.json({ success: false, code, message, errors }, { status });
}

// Accept only the JSON media type and its legitimate charset parameter.
// Splitting before includes() rejects lookalikes such as
// "text/plain; application/json" and "application/jsonp".
const MEDIA_PARAM = /^\s*([!#$%&'*+\-.^_`|~0-9A-Za-z]+)\s*=\s*(?:"((?:[^"\\]|\\.)*)"|([!#$%&'*+\-.^_`|~0-9A-Za-z]+))\s*$/;

function isJsonMediaType(value: string): boolean {
  const [essence, ...params] = value.split(";");
  if (essence.trim().toLowerCase() !== "application/json") return false;
  for (const raw of params) {
    const match = MEDIA_PARAM.exec(raw);
    if (!match || match[1].toLowerCase() !== "charset") return false;
    if ((match[2] ?? match[3] ?? "").toLowerCase() !== "utf-8") return false;
  }
  return true;
}

export function requireJsonPost(request: NextRequest): NextResponse | null {
  let origin: string | null = null;
  try {
    origin = request.headers.get("origin");
    if (!origin || origin.replace(/\/+$/, "") !== trustedOrigin()) {
      return authError("Yêu cầu không hợp lệ. Tải lại trang rồi thử lại.", 403, "BAD_ORIGIN");
    }
  } catch {
    return authError("Dịch vụ đăng nhập chưa được cấu hình.", 503, "AUTH_CONFIG");
  }
  const type = request.headers.get("content-type") ?? "";
  if (!isJsonMediaType(type)) {
    return authError("Dữ liệu gửi lên phải là JSON.", 415, "UNSUPPORTED_MEDIA");
  }
  return null;
}

export async function readJsonObject(request: NextRequest): Promise<
  { ok: true; body: Record<string, unknown> } | { ok: false; response: NextResponse }
> {
  let parsed: unknown;
  try {
    parsed = await request.json();
  } catch {
    return { ok: false, response: authError("Dữ liệu gửi lên chưa hợp lệ.", 400, "INVALID_REQUEST") };
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return { ok: false, response: authError("Dữ liệu gửi lên chưa hợp lệ.", 400, "INVALID_REQUEST") };
  }
  const prototype = Object.getPrototypeOf(parsed);
  if (prototype !== Object.prototype && prototype !== null) {
    return { ok: false, response: authError("Dữ liệu gửi lên chưa hợp lệ.", 400, "INVALID_REQUEST") };
  }
  return { ok: true, body: parsed as Record<string, unknown> };
}

export function requestAborted(): NextResponse {
  return authError("Yêu cầu đã bị hủy.", 499, "REQUEST_ABORTED");
}

async function readJson<T>(response: Response): Promise<Envelope<T> | null> {
  try {
    return (await response.json()) as Envelope<T>;
  } catch {
    return null;
  }
}

function upstreamHeaders(token?: string) {
  return {
    accept: "application/json",
    ...(token ? { authorization: `Bearer ${token}` } : {}),
  };
}

function requestSignal(signal?: AbortSignal): AbortSignal {
  const timeout = AbortSignal.timeout(10000);
  return signal ? AbortSignal.any([signal, timeout]) : timeout;
}

export async function forwardAuth(path: string, body: unknown, signal?: AbortSignal): Promise<{ response: Response; payload: Envelope<{ accessToken?: unknown; tokenType?: unknown; expiresIn?: unknown; username?: unknown; role?: unknown }> | null }> {
  const response = await fetch(`${backendUrl()}${path}`, {
    method: "POST",
    cache: "no-store",
    headers: { ...upstreamHeaders(), "content-type": "application/json" },
    body: JSON.stringify(body),
    signal: requestSignal(signal),
  });
  return { response, payload: await readJson(response) };
}

export async function fetchMyInfo(token: string, signal?: AbortSignal): Promise<{ response: Response; payload: Envelope<Record<string, unknown>> | null }> {
  const response = await fetch(`${backendUrl()}/api/v1/auth/my-info`, {
    method: "GET",
    cache: "no-store",
    headers: upstreamHeaders(token),
    signal: requestSignal(signal),
  });
  return { response, payload: await readJson(response) };
}

export function validateAuthResult(payload: Envelope<Record<string, unknown>> | null): { accessToken: string; expiresIn: number; username: string; role: string } {
  const result = payload?.result;
  if (!payload?.success || !result || typeof result.accessToken !== "string" || !result.accessToken) {
    throw new Error("AUTH_INVALID_RESPONSE");
  }
  const tokenType = typeof result.tokenType === "string" ? result.tokenType : "";
  const expiresIn = typeof result.expiresIn === "number" ? result.expiresIn : NaN;
  if (tokenType.toLowerCase() !== "bearer" || !Number.isFinite(expiresIn) || expiresIn <= 0) {
    throw new Error("AUTH_INVALID_RESPONSE");
  }
  return {
    accessToken: result.accessToken,
    expiresIn,
    username: typeof result.username === "string" ? result.username : "",
    role: typeof result.role === "string" ? result.role : "",
  };
}

export function validateIdentity(payload: Envelope<Record<string, unknown>> | null): SafeIdentity {
  const result = payload?.result;
  if (!payload?.success || !result) throw new Error("IDENTITY_INVALID_RESPONSE");
  const id = typeof result.id === "number" ? result.id : NaN;
  const username = typeof result.username === "string" ? result.username : "";
  const email = typeof result.email === "string" ? result.email : "";
  const role = typeof result.role === "string" ? result.role : "";
  const status = typeof result.status === "string" ? result.status : "";
  const createdAt = typeof result.createdAt === "string" ? result.createdAt : "";
  if (!Number.isInteger(id) || id <= 0 || !username || !email || !role || !status || !createdAt) {
    throw new Error("IDENTITY_INVALID_RESPONSE");
  }
  return { id, username, email, role, status, createdAt };
}

export function mapUpstreamError(status: number, payload: Envelope<unknown> | null): { message: string; code: string; errors?: Array<{ field?: string; reason?: string }> } {
  const upstream = payload?.message ?? "";
  if (status === 401) return { message: "Tên đăng nhập hoặc mật khẩu không đúng.", code: "INVALID_CREDENTIALS" };
  if (status === 403) {
    if (/locked/i.test(upstream)) return { message: "Tài khoản đang bị khóa. Liên hệ hỗ trợ để được giúp.", code: "ACCOUNT_LOCKED" };
    if (/inactive|not active/i.test(upstream)) return { message: "Tài khoản chưa hoạt động hoặc đã bị vô hiệu hóa.", code: "ACCOUNT_INACTIVE" };
    return { message: "Tài khoản không thể đăng nhập lúc này.", code: "ACCOUNT_FORBIDDEN" };
  }
  if (status === 400) {
    if (/username.*exist/i.test(upstream)) return { message: "Tên đăng nhập đã được sử dụng.", code: "USERNAME_TAKEN" };
    if (/email.*exist/i.test(upstream)) return { message: "Email đã được sử dụng.", code: "EMAIL_TAKEN" };
    if (/phone.*exist/i.test(upstream)) return { message: "Số điện thoại đã được sử dụng.", code: "PHONE_TAKEN" };
    return { message: "Thông tin chưa hợp lệ. Kiểm tra lại các trường.", code: "VALIDATION", errors: payload?.errors };
  }
  if (status === 415) return { message: "Dữ liệu gửi lên không được hỗ trợ.", code: "UNSUPPORTED_MEDIA" };
  if (status === 404) return { message: "Không tìm thấy tài khoản.", code: "ACCOUNT_NOT_FOUND" };
  return { message: "Không thể xác thực lúc này. Thử lại sau ít phút.", code: "AUTH_UNAVAILABLE" };
}

function authAttempt(request: NextRequest): string | null {
  const attempt = request.cookies.get(AUTH_ATTEMPT_COOKIE)?.value ?? "";
  return ATTEMPT_PATTERN.test(attempt) ? attempt : null;
}

function authCookieName(request: NextRequest): string | null {
  const attempt = authAttempt(request);
  return attempt ? `${AUTH_COOKIE}.${attempt}` : null;
}

export function hasAuthAttempt(request: NextRequest): boolean {
  return authAttempt(request) !== null;
}

export function authCookie(request: NextRequest): string | null {
  const name = authCookieName(request);
  return name ? request.cookies.get(name)?.value ?? null : null;
}

export function setAuthCookie(response: NextResponse, request: NextRequest, token: string, expiresIn: number): void {
  const name = authCookieName(request);
  if (!name) return;
  const maxAge = Math.max(1, Math.min(Math.floor(expiresIn), MAX_COOKIE_AGE));
  response.cookies.set(name, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge,
    secure: new URL(request.url).protocol === "https:",
  });
}

export function clearAuthCookie(response: NextResponse, request: NextRequest): void {
  const name = authCookieName(request);
  if (name) response.cookies.set(name, "", { httpOnly: true, sameSite: "lax", path: "/", maxAge: 0 });
}
