"use client";

import { InfoHint } from "./info-hint";

/**
 * One row: title (h1) on the left with an optional hint, actions on the right. No subtitle.
 *
 *   <PageHeader title="Đơn hàng" hint="Đơn mới cần xác nhận trước khi đóng gói."
 *     actions={<button className="primary">Tạo đơn</button>} />
 */
export function PageHeader({ title, actions, hint }: { title: string; actions?: React.ReactNode; hint?: React.ReactNode }) {
  return (
    <div className="page-head">
      <div className="page-head-title">
        <h1>{title}</h1>
        {hint ? <InfoHint>{hint}</InfoHint> : null}
      </div>
      {actions ? <div className="page-head-actions">{actions}</div> : null}
    </div>
  );
}
