"use client";

import { useEffect, useState } from "react";
import {
  THEME_CHOICE_LABELS,
  THEME_CHOICES,
  readStoredTheme,
  resolveTheme,
  writeStoredTheme,
  type ThemeChoice,
} from "@/lib/theme";

/**
 * Control "Giao diện" (Theo thiết bị / Sáng / Tối).
 *
 * - Chỉ nhớ lựa chọn ở localStorage (không đụng tài khoản, không đổi auth).
 * - Khi đang ở "Theo thiết bị", đổi theme hệ điều hành sẽ cập nhật ngay.
 * - Không render nội dung phụ thuộc theme trước khi đọc localStorage, để không
 *   lệch hydration: ban đầu luôn là "system" rồi cập nhật sau mount.
 */
export function ThemeControl({ className = "" }: { className?: string }) {
  const [choice, setChoice] = useState<ThemeChoice>("system");

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");

    function apply() {
      const stored = readStoredTheme(window.localStorage);
      const effective = resolveTheme(stored, media.matches);
      const root = document.documentElement;
      root.setAttribute("data-theme", effective);
      root.setAttribute("data-theme-choice", stored);
      setChoice(stored);
    }

    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, []);

  function onChange(next: ThemeChoice) {
    writeStoredTheme(next, window.localStorage);
    const effective = resolveTheme(next, window.matchMedia("(prefers-color-scheme: dark)").matches);
    const root = document.documentElement;
    root.setAttribute("data-theme", effective);
    root.setAttribute("data-theme-choice", next);
    setChoice(next);
  }

  return (
    <label className={`stTheme ${className}`.trim()}>
      <span className="stThemeLabel">Giao diện</span>
      <select
        className="stThemeSelect"
        value={choice}
        onChange={(e) => onChange(e.target.value as ThemeChoice)}
        aria-label="Giao diện"
      >
        {THEME_CHOICES.map((c) => (
          <option key={c} value={c}>{THEME_CHOICE_LABELS[c]}</option>
        ))}
      </select>
    </label>
  );
}
