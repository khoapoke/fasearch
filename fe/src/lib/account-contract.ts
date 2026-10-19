// Pure account helpers: local return navigation allowlist plus client-side
// validation mirrors. The backend stays authoritative; these only give fast,
// friendly feedback before a request is sent.

const USERNAME = /^[A-Za-z0-9_.-]+$/;
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

function codePoints(value: string): number {
  return [...value].length;
}

function utf8Bytes(value: string): number {
  return new TextEncoder().encode(value).length;
}

function hasControlChar(value: string): boolean {
  for (const char of value) {
    const code = char.codePointAt(0) ?? 0;
    if ((code >= 0 && code <= 0x1f) || code === 0x7f) return true;
  }
  return false;
}

// Local return targets only. Auth routes are rejected to avoid login loops;
// query strings survive only on allowlisted paths.
export function safeAccountReturnHref(raw: string | null): string {
  const fallback = "/tai-khoan";
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return fallback;
  if (raw.includes("\\") || hasControlChar(raw)) return fallback;
  const queryIndex = raw.indexOf("?");
  const hashIndex = raw.indexOf("#");
  const end = queryIndex === -1 ? hashIndex : hashIndex === -1 ? queryIndex : Math.min(queryIndex, hashIndex);
  const path = end === -1 ? raw : raw.slice(0, end);
  // Bounded recursive canonicalization (max 3 rounds): catches single and
  // double encoding without unbounded decode loops. Any encoded ambiguity
  // (changed form, malformed escapes, decoded backslash/control/traversal)
  // fails closed to the fallback.
  let canonical = path;
  for (let round = 0; round < 3; round++) {
    let next: string;
    try {
      next = decodeURIComponent(canonical);
    }
    catch {
      return fallback;
    }
    if (next === canonical) break;
    canonical = next;
  }
  if (
    canonical !== path ||
    canonical.includes("\\") ||
    hasControlChar(canonical) ||
    canonical.split("/").includes("..")
  ) {
    return fallback;
  }
  const allowed =
    canonical === "/" ||
    canonical === "/tai-khoan" ||
    canonical.startsWith("/tai-khoan/") ||
    canonical === "/tim-kiem-ai" ||
    canonical === "/gio-hang" ||
    canonical === "/thanh-toan" ||
    canonical === "/don-hang" ||
    canonical.startsWith("/don-hang/") ||
    canonical === "/kenh-ban/pos" ||
    canonical === "/kenh-ban/don-hang" ||
    canonical.startsWith("/kenh-ban/don-hang/") ||
    canonical === "/quan-tri" ||
    canonical.startsWith("/quan-tri/");
  if (!allowed) return fallback;
  return raw;
}

export function validateUsernameInput(value: string): string | null {
  const username = value.trim();
  if ([...username].length < 1 || [...username].length > 50 || !USERNAME.test(username)) {
    return "Tên đăng nhập 1–50 ký tự: chữ, số, gạch dưới, chấm hoặc gạch ngang.";
  }
  return null;
}

export function validateEmailInput(value: string): string | null {
  const email = value.trim();
  if (email.length === 0 || email.length > 100 || !EMAIL.test(email)) {
    return "Email chưa đúng định dạng (tối đa 100 ký tự).";
  }
  return null;
}

export function validateNewPasswordInput(value: string): string | null {
  if (codePoints(value) < 15 || codePoints(value) > 64) {
    return "Mật khẩu mới 15–64 ký tự.";
  }
  if (utf8Bytes(value) > 72) {
    return "Mật khẩu mới vượt quá 72 byte UTF-8 mà hệ thống băm mật khẩu hỗ trợ.";
  }
  return null;
}
