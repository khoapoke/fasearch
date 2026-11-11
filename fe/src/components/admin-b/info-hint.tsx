"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Icon } from "./icons";

/**
 * Small "?" button that opens a popover with rule text. Click or Enter/Space opens,
 * Esc and outside click close. The popover is fixed-positioned so tables never clip it.
 *
 *   <InfoHint>Mỗi lần sửa tạo một phiên bản mới.</InfoHint>
 *   <InfoHint label="Quy tắc xóa" align="end">...</InfoHint>
 */
export function InfoHint({ children, label = "Xem giải thích", align = "start" }: { children: React.ReactNode; label?: string; align?: "start" | "end" }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number; origin: string } | null>(null);
  const button = useRef<HTMLButtonElement>(null);
  const pop = useRef<HTMLDivElement>(null);
  const id = useId();

  useEffect(() => {
    if (!open) return;
    const place = () => {
      const rect = button.current?.getBoundingClientRect();
      if (!rect) return;
      const width = Math.min(300, window.innerWidth - 24);
      let left = align === "end" ? rect.right - width : rect.left;
      left = Math.max(12, Math.min(left, window.innerWidth - width - 12));
      const height = pop.current?.offsetHeight ?? 80;
      const below = rect.bottom + 8 + height <= window.innerHeight - 8;
      const top = below ? rect.bottom + 8 : Math.max(8, rect.top - 8 - height);
      setPos({ top, left, origin: `${Math.round(rect.left + rect.width / 2 - left)}px ${below ? "top" : "bottom"}` });
    };
    place();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        // preventDefault keeps a surrounding dialog from treating this Esc as its own close request.
        event.preventDefault();
        event.stopPropagation();
        setOpen(false);
        button.current?.focus();
      }
    };
    const onDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!pop.current?.contains(target) && !button.current?.contains(target)) setOpen(false);
    };
    document.addEventListener("keydown", onKey, true);
    document.addEventListener("pointerdown", onDown);
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      document.removeEventListener("keydown", onKey, true);
      document.removeEventListener("pointerdown", onDown);
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open, align]);

  return (
    <span className="info-hint">
      <button ref={button} className="info-hint-btn" type="button" aria-label={label} aria-expanded={open} aria-controls={open ? id : undefined} onClick={() => { setPos(null); setOpen((v) => !v); }}>
        <Icon name="circle-help" size={16} />
      </button>
      {open ? (
        <div ref={pop} id={id} role="note" className="info-hint-pop" style={pos ? { top: pos.top, left: pos.left, transformOrigin: pos.origin } : { visibility: "hidden", top: 0, left: 0 }}>
          {children}
        </div>
      ) : null}
    </span>
  );
}
