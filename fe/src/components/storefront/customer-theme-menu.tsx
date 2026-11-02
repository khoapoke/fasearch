"use client";

import { useEffect, useRef, useState } from "react";
import {
  readStoredTheme,
  resolveTheme,
  writeStoredTheme,
  type ThemeChoice,
} from "@/lib/theme";

/**
 * Bộ chọn giao diện Customer: một nút icon 40px + popover nhỏ.
 * - Chỉ nhớ lựa chọn ở localStorage (`fa-theme`), không đụng tài khoản/auth.
 * - "Theo hệ thống" vẫn nghe thay đổi theme của thiết bị.
 * - Hydration: luôn bắt đầu ở "system" rồi đọc localStorage sau mount.
 * - Popover là nhóm nút aria-pressed (không phải menu ARIA) nên không cần
 *   arrow/Home/End; Tab đi ra ngoài bình thường, Escape đóng và trả tiêu điểm.
 */

const OPTIONS: { value: ThemeChoice; label: string }[] = [
  { value: "light", label: "Sáng" },
  { value: "dark", label: "Tối" },
  { value: "system", label: "Theo hệ thống" },
];

function labelOf(choice: ThemeChoice): string {
  return OPTIONS.find((option) => option.value === choice)?.label ?? "Theo hệ thống";
}

function ThemeIcon({ choice }: { choice: ThemeChoice }) {
  const common = {
    className: "chThemeIcon",
    "aria-hidden": true as const,
    focusable: "false" as const,
    viewBox: "0 0 20 20",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.5,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  if (choice === "dark") {
    return (
      <svg {...common}>
        <path d="M16.5 12.2A7 7 0 0 1 7.8 3.5a7 7 0 1 0 8.7 8.7Z" />
      </svg>
    );
  }
  if (choice === "light") {
    return (
      <svg {...common}>
        <circle cx="10" cy="10" r="3.4" />
        <path d="M10 2.2v1.6M10 16.2v1.6M2.2 10h1.6M16.2 10h1.6M4.5 4.5l1.1 1.1M14.4 14.4l1.1 1.1M15.5 4.5l-1.1 1.1M5.6 14.4l-1.1 1.1" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <rect x="2.5" y="3.5" width="15" height="10" rx="1.5" />
      <path d="M7 17h6M10 13.5V17" />
    </svg>
  );
}

function OptionIcon({ choice }: { choice: ThemeChoice }) {
  return <ThemeIcon choice={choice} />;
}

export function CustomerThemeMenu({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [choice, setChoice] = useState<ThemeChoice>("system");
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);

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

  useEffect(() => {
    if (!open) return;
    const selected = popoverRef.current?.querySelector<HTMLButtonElement>("[aria-pressed='true']");
    (selected ?? popoverRef.current?.querySelector<HTMLButtonElement>("button"))?.focus();

    function onKey(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      onOpenChange(false);
      triggerRef.current?.focus();
    }
    function onPointer(event: PointerEvent) {
      const target = event.target as Node;
      if (popoverRef.current?.contains(target) || triggerRef.current?.contains(target)) return;
      onOpenChange(false);
    }
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [open, onOpenChange]);

  function select(next: ThemeChoice) {
    writeStoredTheme(next, window.localStorage);
    const effective = resolveTheme(next, window.matchMedia("(prefers-color-scheme: dark)").matches);
    const root = document.documentElement;
    root.setAttribute("data-theme", effective);
    root.setAttribute("data-theme-choice", next);
    setChoice(next);
    onOpenChange(false);
    triggerRef.current?.focus();
  }

  return (
    <div
      className="chTheme"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) onOpenChange(false);
      }}
    >
      <button
        ref={triggerRef}
        type="button"
        className="chThemeBtn"
        aria-expanded={open}
        aria-controls="ch-theme-popover"
        aria-label={`Giao diện: ${labelOf(choice)}`}
        title={`Giao diện: ${labelOf(choice)}`}
        onClick={() => onOpenChange(!open)}
      >
        <ThemeIcon choice={choice} />
      </button>
      {open ? (
        <div
          className="chThemePop"
          id="ch-theme-popover"
          role="group"
          aria-label="Chọn giao diện"
          ref={popoverRef}
        >
          {OPTIONS.map((option) => {
            const pressed = option.value === choice;
            return (
              <button
                key={option.value}
                type="button"
                className="chThemeOpt"
                aria-pressed={pressed}
                onClick={() => select(option.value)}
              >
                <OptionIcon choice={option.value} />
                <span>{option.label}</span>
                {pressed ? (
                  <svg className="chThemeCheck" aria-hidden="true" focusable="false" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="m3.5 8.5 3 3 6-6.5" />
                  </svg>
                ) : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
