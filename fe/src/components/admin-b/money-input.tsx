"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { formatNumber } from "@/lib/admin-format";
import { MONEY_INVALID, moneyState } from "@/lib/money-input";

type Props = Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "type"> & {
  /** Canonical numeric string ("1450000.5"), "" or MONEY_INVALID. Never rounded. */
  value: string;
  onChange: (value: string) => void;
};

/**
 * While focused the field shows exactly what was typed, so the caret never jumps.
 * On blur a valid value is shown grouped (1.450.000); unreadable text stays as typed
 * and the parent receives MONEY_INVALID so its own validation shows the error.
 */
export function MoneyInput({ value, onChange, onFocus, onBlur, ...rest }: Props) {
  const [draft, setDraft] = useState<string | null>(null);
  const [focused, setFocused] = useState(false);
  const invalidValue = value === MONEY_INVALID;
  const shown = draft ?? (value && !invalidValue ? formatNumber(Number(value)) : "");
  const inputRef = useRef<HTMLInputElement>(null);
  const reselect = useRef(false);
  // Tabbing in selects the whole field; swapping grouped text for raw digits would collapse that
  // selection, and the next key would append to the old price instead of replacing it.
  useLayoutEffect(() => {
    if (focused && reselect.current) inputRef.current?.select();
    reselect.current = false;
  }, [focused]);
  return (
    <input
      {...rest}
      ref={inputRef}
      type="text"
      inputMode="decimal"
      autoComplete="off"
      value={shown}
      aria-invalid={rest["aria-invalid"] ?? (invalidValue && !focused ? true : undefined)}
      onFocus={(event) => {
        const el = event.target;
        reselect.current = el.value.length > 0 && el.selectionStart === 0 && el.selectionEnd === el.value.length;
        setFocused(true);
        setDraft((current) => current ?? (invalidValue ? "" : value));
        onFocus?.(event);
      }}
      onChange={(event) => {
        setDraft(event.target.value);
        onChange(moneyState(event.target.value));
      }}
      onBlur={(event) => {
        setFocused(false);
        if (!invalidValue) setDraft(null);
        onBlur?.(event);
      }}
    />
  );
}
