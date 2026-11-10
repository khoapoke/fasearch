"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Icon } from "./icons";

export type ModalSize = "sm" | "md" | "lg";

/**
 * Native <dialog> modal (focus trap and Esc come from the browser).
 * Header and footer stay fixed, the body scrolls. Phones get a bottom sheet.
 *
 *   <AdminModal open={open} title="Tạo danh mục" size="sm" onClose={() => setOpen(false)}
 *     footer={<><button className="secondary" onClick={close}>Hủy</button><button className="primary">Lưu</button></>}>
 *     ...form...
 *   </AdminModal>
 *
 * `busy` blocks Esc and backdrop close. `headerActions` sits beside the close button.
 */
export function AdminModal({
  open,
  title,
  description,
  size = "md",
  onClose,
  footer,
  busy = false,
  headerActions,
  children,
}: {
  open: boolean;
  title: string;
  description?: string;
  size?: ModalSize;
  onClose: () => void;
  footer?: React.ReactNode;
  busy?: boolean;
  headerActions?: React.ReactNode;
  children?: React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLElement | null>(null);
  const titleId = useId();
  // Children stay mounted for the 120ms exit so the dialog does not collapse while fading.
  const [mounted, setMounted] = useState(open);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open) {
      void Promise.resolve().then(() => setMounted(true));
      trigger.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      if (!dialog.open) dialog.showModal();
      return;
    }
    if (dialog.open) dialog.close();
    const timer = window.setTimeout(() => setMounted(false), 160);
    const back = trigger.current;
    trigger.current = null;
    if (back && document.contains(back)) back.focus({ preventScroll: true });
    return () => window.clearTimeout(timer);
  }, [open]);

  return (
    <dialog
      ref={ref}
      className={`adm-modal ${size}`}
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onClose();
      }}
      onClick={(event) => {
        if (event.target === ref.current && !busy) onClose();
      }}
    >
      {open || mounted ? (
        <div className="adm-modal-panel">
          <header className="adm-modal-head">
            <div>
              <h2 id={titleId}>{title}</h2>
              {description ? <p className="meta">{description}</p> : null}
            </div>
            <div className="adm-modal-head-actions">
              {headerActions}
              <button className="icon-btn" type="button" aria-label="Đóng" disabled={busy} onClick={onClose}><Icon name="x" size={18} /></button>
            </div>
          </header>
          <div className="adm-modal-body">{children}</div>
          {footer ? <footer className="adm-modal-foot">{footer}</footer> : null}
        </div>
      ) : null}
    </dialog>
  );
}
