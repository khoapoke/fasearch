"use client";

import { AdminModal } from "./modal";

/**
 * One-step confirmation.
 *
 *   <ConfirmDialog open={!!target} title="Ngừng kinh doanh sản phẩm?" message="..."
 *     confirmLabel="Ngừng kinh doanh" tone="danger" busy={busy} error={error}
 *     onConfirm={run} onClose={() => setTarget(null)}>
 *     <label>Ghi chú<input .../></label>   // optional extra fields
 *   </ConfirmDialog>
 */
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Xác nhận",
  cancelLabel = "Hủy",
  tone = "primary",
  busy = false,
  error = "",
  onConfirm,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  message?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "primary" | "danger";
  busy?: boolean;
  error?: string;
  onConfirm: () => void;
  onClose: () => void;
  children?: React.ReactNode;
}) {
  return (
    <AdminModal
      open={open}
      title={title}
      size="sm"
      busy={busy}
      onClose={onClose}
      footer={
        <>
          <button className="secondary" type="button" disabled={busy} onClick={onClose}>{cancelLabel}</button>
          <button className={tone === "danger" ? "danger solid" : "primary"} type="button" disabled={busy} aria-busy={busy} onClick={onConfirm}>
            {busy ? "Đang xử lý…" : confirmLabel}
          </button>
        </>
      }
    >
      {message ? <p className="adm-modal-text">{message}</p> : null}
      {children}
      {error ? <p className="catalog-error" role="alert">{error}</p> : null}
    </AdminModal>
  );
}
