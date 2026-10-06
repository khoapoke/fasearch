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
    canonical === "/catalog" ||
    canonical.startsWith("/catalog/") ||
    canonical === "/search/text" ||
    canonical === "/search/composed";
  if (!allowed) return fallback;
  return raw;
}

export function validateUsernameInput(value: string): string | null {
  const username = value.trim();
  if ([...username].length < 3 || [...username].length > 100 || !USERNAME.test(username)) {
    return "Tên đăng nhập 3–100 ký tự: chữ, số, gạch dưới, chấm hoặc gạch ngang.";
  }
  return null;
}

export function validateEmailInput(value: string): string | null {
  const email = value.trim();
  if (email.length === 0 || email.length > 254 || !EMAIL.test(email)) {
    return "Email chưa đúng định dạng.";
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

export function validateDisplayNameInput(value: string): string | null {
  const displayName = value.trim();
  if (displayName.length === 0) return "Tên hiển thị không được để trống.";
  if (codePoints(displayName) < 1 || codePoints(displayName) > 100) {
    return "Tên hiển thị 1–100 ký tự.";
  }
  if (hasControlChar(displayName)) return "Tên hiển thị không chứa ký tự điều khiển.";
  return null;
}

export type RegisterIssues = {
  username?: string;
  email?: string;
  password?: string;
  displayName?: string;
};

export function validateRegisterInput(input: {
  username: string;
  email: string;
  password: string;
  displayName?: string;
}): RegisterIssues {
  const issues: RegisterIssues = {};
  const usernameIssue = validateUsernameInput(input.username);
  if (usernameIssue) issues.username = usernameIssue;
  const emailIssue = validateEmailInput(input.email);
  if (emailIssue) issues.email = emailIssue;
  const passwordIssue = validateNewPasswordInput(input.password);
  if (passwordIssue) issues.password = passwordIssue;
  if (input.displayName !== undefined && input.displayName !== null) {
    const displayIssue = validateDisplayNameInput(input.displayName);
    if (displayIssue) issues.displayName = displayIssue;
  }
  return issues;
}
