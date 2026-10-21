// Search-studio pilot: lựa chọn giao diện của thiết bị.
//
// Ràng buộc (DESIGN §2): mặc định theo hệ điều hành; người dùng có thể chọn
// "Theo thiết bị" / "Sáng" / "Tối"; CHỈ nhớ lựa chọn thiết bị ở localStorage
// (không đụng tài khoản, không đổi auth storage); theme áp dụng phải không gây
// flash sai màu hay lệch hydration.
//
// File này chỉ chứa logic thuần để test được; phần gắn vào DOM nằm ở
// components/studio/theme-control.tsx và script boot trong app/layout.tsx.

export type ThemeChoice = "system" | "light" | "dark";
export type EffectiveTheme = "light" | "dark";

export const THEME_STORAGE_KEY = "fa-theme";

export const THEME_CHOICES: ThemeChoice[] = ["system", "light", "dark"];

export const THEME_CHOICE_LABELS: Record<ThemeChoice, string> = {
  system: "Theo thiết bị",
  light: "Sáng",
  dark: "Tối",
};

/** Giá trị lưu có hợp lệ không; rác thì coi như "system" (mặc định OS). */
export function normalizeThemeChoice(value: unknown): ThemeChoice {
  return value === "light" || value === "dark" || value === "system" ? value : "system";
}

/** Theme hiệu dụng: lựa chọn thiết bị + trạng thái OS. */
export function resolveTheme(choice: ThemeChoice, prefersDark: boolean): EffectiveTheme {
  if (choice === "light") return "light";
  if (choice === "dark") return "dark";
  return prefersDark ? "dark" : "light";
}

/** Đọc lựa chọn đã lưu (an toàn khi localStorage bị chặn). */
export function readStoredTheme(storage?: Pick<Storage, "getItem"> | null): ThemeChoice {
  try {
    return normalizeThemeChoice(storage?.getItem(THEME_STORAGE_KEY));
  } catch {
    return "system";
  }
}

/** Ghi lựa chọn; trả về false nếu trình duyệt chặn storage. */
export function writeStoredTheme(choice: ThemeChoice, storage?: Pick<Storage, "setItem"> | null): boolean {
  try {
    storage?.setItem(THEME_STORAGE_KEY, choice);
    return true;
  } catch {
    return false;
  }
}

/**
 * Script boot chạy TRƯỚC lần vẽ đầu tiên: đọc lựa chọn + OS, rồi đặt
 * `data-theme` (theme hiệu dụng) và `data-theme-choice` (lựa chọn của người dùng)
 * trên <html>. Nhờ vậy không có flash sai màu và React không thấy markup khác
 * giữa server và client (không lệch hydration).
 *
 * Script tự chứa, không import: chạy trước khi bundle tải xong.
 */
export function themeBootScript(): string {
  return `(function(){try{var k=${JSON.stringify(THEME_STORAGE_KEY)};var s=localStorage.getItem(k);`
    + `var c=(s==="light"||s==="dark"||s==="system")?s:"system";`
    + `var d=(c==="dark")||(c==="system"&&window.matchMedia&&window.matchMedia("(prefers-color-scheme: dark)").matches);`
    + `var r=document.documentElement;r.setAttribute("data-theme",d?"dark":"light");r.setAttribute("data-theme-choice",c);`
    + `}catch(e){}})();`;
}
