"use client";

import { AdminModal } from "./modal";

/**
 * Hộp thoại xóa mềm dùng chung cho sản phẩm, SKU và danh mục.
 *
 * - Nêu rõ hậu quả thật: dữ liệu vào thùng rác, khôi phục được, không xóa vĩnh viễn.
 * - Lý do không bắt buộc, tối đa 255 ký tự (đúng giới hạn của BE).
 * - Từ chối của guard hiển thị ngay trong hộp thoại, kèm hành động thay thế khi có
 *   (ví dụ "Ngừng kinh doanh" thay vì xóa).
 */
export function DeleteReasonPanel({
  open,
  title,
  target,
  consequence,
  busy,
  refusal,
  onClose,
  onConfirm,
  alternative,
}: {
  open: boolean;
  title: string;
  target: string;
  consequence: string;
  busy: boolean;
  refusal: string;
  onClose: () => void;
  onConfirm: (reason: string) => void;
  alternative?: { label: string; hint: string; onClick: () => void };
}) {
  const id = "delete-reason";
  return (
    <AdminModal
      open={open}
      title={title}
      description={target}
      size="sm"
      busy={busy}
      onClose={onClose}
      footer={
        <>
          {alternative ? (
            <button className="secondary" type="button" disabled={busy} onClick={alternative.onClick} title={alternative.hint} style={{ marginRight: "auto" }}>
              {alternative.label}
            </button>
          ) : null}
          <button className="secondary" type="button" onClick={onClose} disabled={busy}>Hủy</button>
          <button className="danger solid" type="submit" form="delete-reason-form" disabled={busy}>
            {busy ? "Đang xử lý…" : "Xóa và chuyển vào thùng rác"}
          </button>
        </>
      }
    >
      <p className="adm-modal-text">{consequence}</p>
      <form
        id="delete-reason-form"
        className="catalog-form"
        onSubmit={(event) => {
          event.preventDefault();
          const field = event.currentTarget.elements.namedItem("delete-reason") as HTMLInputElement | null;
          onConfirm(field?.value ?? "");
        }}
      >
        <div className="catalog-field full">
          <label htmlFor={id}>Lý do xóa (không bắt buộc, tối đa 255 ký tự)</label>
          <input id={id} name={id} className="catalog-input" maxLength={255} disabled={busy} autoComplete="off" />
        </div>
        {refusal ? <p className="catalog-error" role="alert">{refusal}</p> : null}
      </form>
    </AdminModal>
  );
}
