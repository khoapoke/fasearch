"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ConfirmDialog } from "./confirm-dialog";
import { InfoHint } from "./info-hint";
import { CardSkeleton } from "./skeleton";
import { useToast } from "./toast";
import { useAdminIdentity } from "./admin-frame";
import { getStaffPermissionAudit, getStaffPermissions, saveStaffPermissions, type PermissionAudit, type RolePermissions } from "@/lib/admin-role-permissions-client";
import { formatDateTime } from "@/lib/admin-format";
import "./o1.css";

/** Quyền thao tác cần quyền xem tương ứng thì mới dùng được (mục trên menu bị ẩn khi tắt quyền xem). */
const NEEDS_VIEW: Record<string, string> = {
  ORDER_UPDATE_STATUS: "ORDER_VIEW", ORDER_CANCEL: "ORDER_VIEW", ORDER_COLLECT_CASH: "ORDER_VIEW",
  CUSTOMER_CREATE: "CUSTOMER_VIEW", CUSTOMER_EDIT: "CUSTOMER_VIEW", CUSTOMER_DELETE: "CUSTOMER_VIEW",
  EMPLOYEE_CREATE: "EMPLOYEE_VIEW", EMPLOYEE_EDIT: "EMPLOYEE_VIEW", EMPLOYEE_DELETE: "EMPLOYEE_VIEW",
  PRODUCT_EDIT: "PRODUCT_VIEW", PRODUCT_DELETE: "PRODUCT_VIEW", PRODUCT_PUBLISH: "PRODUCT_VIEW", PRODUCT_IMPORT: "PRODUCT_VIEW",
  CATEGORY_MANAGE: "PRODUCT_VIEW", REVIEW_MODERATE: "PRODUCT_VIEW",
  INVENTORY_RECEIPT_CREATE: "INVENTORY_VIEW", STOCKTAKE_CREATE: "INVENTORY_VIEW",
  PROMOTION_MANAGE: "PROMOTION_VIEW", LOYALTY_POLICY_MANAGE: "LOYALTY_POLICY_VIEW", LOYALTY_ADJUST: "CUSTOMER_VIEW",
  TRASH_RESTORE: "TRASH_VIEW",
};

const HINTS: Record<string, string> = {
  POS_USE: "Bán tại quầy cũng cần Xem đơn hàng, Xem khách hàng (tìm khách theo số điện thoại) và Hủy đơn (hủy đơn Draft).",
  ORDER_COLLECT_CASH: "Ghi nhận khách đã trả tiền mặt cho đơn COD đang giao.",
  DATA_EXPORT: "Chỉ Export được dữ liệu mà Quản lý cũng có quyền xem (sản phẩm, tồn kho, đơn hàng, khách hàng).",
  LOYALTY_ADJUST: "Quyền mới, mặc định tắt. Cộng/trừ điểm thủ công và tính lại điểm cho đơn thiếu điểm.",
  EMPLOYEE_EDIT: "Quản lý không sửa, xóa hoặc khôi phục được hồ sơ của Quản trị viên và không liên kết tài khoản đăng nhập, kể cả khi bật quyền.",
  TRASH_RESTORE: "Không gồm tab Tài khoản và hồ sơ của Quản trị viên: luôn chỉ Quản trị viên.",
};

const ADMIN_ONLY = [
  "Tài khoản đăng nhập và vai trò",
  "Vai trò & quyền (màn hình này)",
  "Thùng rác: tab Tài khoản",
  "Ghi nhận số dư điểm ban đầu",
  "Liên kết tài khoản với hồ sơ nhân sự",
];

const sameSet = (a: Set<string>, b: Set<string>) => a.size === b.size && [...a].every((x) => b.has(x));

export function RolePermissionsEditor() {
  const toast = useToast();
  const me = useAdminIdentity();
  const [data, setData] = useState<RolePermissions | null>(null);
  const [saved, setSaved] = useState<Set<string>>(new Set());
  const [draft, setDraft] = useState<Set<string>>(new Set());
  const [error, setError] = useState("");
  const [nonce, setNonce] = useState(0);
  const [audit, setAudit] = useState<PermissionAudit[] | null>(null);
  const [auditError, setAuditError] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [saveError, setSaveError] = useState("");
  const busyRef = useRef(false);

  const loadAudit = useCallback((signal?: AbortSignal) => {
    getStaffPermissionAudit(signal)
      .then((rows) => { if (!signal?.aborted) { setAudit(rows); setAuditError(""); } })
      .catch((e) => { if (!signal?.aborted) setAuditError(e instanceof Error ? e.message : "Không tải được nhật ký."); });
  }, []);

  useEffect(() => {
    const c = new AbortController();
    getStaffPermissions(c.signal)
      .then((res) => { if (c.signal.aborted) return; const s = new Set(res.enabled); setData(res); setSaved(s); setDraft(new Set(s)); setError(""); })
      .catch((e) => { if (!c.signal.aborted) setError(e instanceof Error ? e.message : "Không tải được phân quyền."); });
    loadAudit(c.signal);
    return () => c.abort();
  }, [nonce, loadAudit]);

  const labels = useMemo(() => {
    const m = new Map<string, string>();
    data?.groups.forEach((g) => g.permissions.forEach((p) => m.set(p.code, p.label)));
    return m;
  }, [data]);
  const label = useCallback((code: string) => labels.get(code) ?? code, [labels]);
  const order = useMemo(() => data?.groups.flatMap((g) => g.permissions.map((p) => p.code)) ?? [], [data]);
  const added = useMemo(() => order.filter((c) => draft.has(c) && !saved.has(c)), [order, draft, saved]);
  const removed = useMemo(() => order.filter((c) => !draft.has(c) && saved.has(c)), [order, draft, saved]);
  const dirty = added.length + removed.length > 0;

  useEffect(() => {
    if (!dirty) return;
    const onLeave = (event: BeforeUnloadEvent) => { event.preventDefault(); };
    window.addEventListener("beforeunload", onLeave);
    return () => window.removeEventListener("beforeunload", onLeave);
  }, [dirty]);

  function toggle(code: string, on: boolean) {
    setDraft((prev) => { const next = new Set(prev); if (on) next.add(code); else next.delete(code); return next; });
  }
  function toggleGroup(codes: string[], on: boolean) {
    setDraft((prev) => { const next = new Set(prev); codes.forEach((c) => (on ? next.add(c) : next.delete(c))); return next; });
  }

  async function save() {
    if (busyRef.current) return;
    busyRef.current = true; setBusy(true); setSaveError("");
    try {
      const res = await saveStaffPermissions(order.filter((c) => draft.has(c)));
      const s = new Set(res.enabled);
      setData(res); setSaved(s); setDraft(new Set(s)); setConfirming(false);
      toast.success(sameSet(s, saved) ? "Không có thay đổi." : "Đã lưu phân quyền Quản lý. Có hiệu lực từ thao tác kế tiếp của họ.");
      loadAudit();
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Chưa lưu được phân quyền. Thử lại.");
    } finally {
      busyRef.current = false; setBusy(false);
    }
  }

  if (me && me.role !== "ADMIN") return <div className="order-empty" role="alert"><strong>Không có quyền</strong><p>Chỉ Quản trị viên xem và sửa được phân quyền.</p></div>;
  if (error) return <div className="order-empty" role="alert"><strong>Không tải được phân quyền</strong><p>{error}</p><button className="secondary" type="button" onClick={() => setNonce((n) => n + 1)}>Thử lại</button></div>;
  if (!data) return <div className="o1-perm" aria-busy="true"><CardSkeleton height={120} /><CardSkeleton height={220} /></div>;

  return (
    <div className="o1-perm">
      <p className="meta o1-lead">Quản trị viên luôn có toàn quyền. Bật hoặc tắt từng quyền cho vai trò <strong>Quản lý</strong>; thay đổi áp dụng cho mọi tài khoản Quản lý từ thao tác kế tiếp, không cần đăng nhập lại.</p>
      <div className="table-scroll o1-table-wrap">
        <table className="o1-table">
          <caption className="sr-only">Phân quyền theo vai trò</caption>
          <thead><tr><th scope="col">Quyền</th><th scope="col" className="o1-col">Quản trị viên</th><th scope="col" className="o1-col">Quản lý</th></tr></thead>
          {data.groups.map((g) => {
            const codes = g.permissions.map((p) => p.code);
            const onCount = codes.filter((c) => draft.has(c)).length;
            const groupId = `o1-group-${g.code}`;
            return (
              <tbody key={g.code} className="o1-group">
                <tr className="o1-group-row">
                  <th scope="rowgroup" id={groupId}>{g.label}<span className="o1-count">{onCount}/{codes.length}</span></th>
                  <td className="o1-col"><span className="o1-full">Toàn quyền</span></td>
                  <td className="o1-col">
                    <label className="o1-check o1-group-toggle">
                      <input type="checkbox" checked={onCount === codes.length} ref={(el) => { if (el) el.indeterminate = onCount > 0 && onCount < codes.length; }}
                        disabled={busy} onChange={(e) => toggleGroup(codes, e.target.checked)} aria-label={`Bật hoặc tắt cả nhóm ${g.label} cho Quản lý`} />
                      <span>Cả nhóm</span>
                    </label>
                  </td>
                </tr>
                {g.permissions.map((p) => {
                  const on = draft.has(p.code);
                  const changed = on !== saved.has(p.code);
                  const view = NEEDS_VIEW[p.code];
                  const orphan = on && view && !draft.has(view);
                  const id = `o1-${p.code}`;
                  return (
                    <tr key={p.code} className={changed ? "o1-changed" : undefined}>
                      <th scope="row">
                        <label htmlFor={id} className="o1-label">{p.label}</label>
                        {HINTS[p.code] ? <InfoHint label={`Giải thích: ${p.label}`}>{HINTS[p.code]}</InfoHint> : null}
                        {orphan ? <span className="o1-warn">Cần bật “{label(view)}” để dùng được</span> : null}
                        {changed ? <span className="o1-pill">{on ? "Sẽ bật" : "Sẽ tắt"}</span> : null}
                      </th>
                      <td className="o1-col"><span className="o1-full" aria-label="Quản trị viên: có">✓</span></td>
                      <td className="o1-col"><span className="o1-check"><input id={id} type="checkbox" checked={on} disabled={busy} onChange={(e) => toggle(p.code, e.target.checked)} /></span></td>
                    </tr>
                  );
                })}
              </tbody>
            );
          })}
          <tbody className="o1-group">
            <tr className="o1-group-row"><th scope="rowgroup">Chỉ Quản trị viên</th><td className="o1-col"><span className="o1-full">Toàn quyền</span></td><td className="o1-col"><span className="o1-fixed">Không bật được</span></td></tr>
            {ADMIN_ONLY.map((text) => <tr key={text} className="o1-fixed-row"><th scope="row">{text}</th><td className="o1-col"><span className="o1-full" aria-label="Quản trị viên: có">✓</span></td><td className="o1-col"><span className="o1-no" aria-label="Quản lý: không">—</span></td></tr>)}
          </tbody>
        </table>
      </div>

      <div className="action-bar o1-bar" role="region" aria-label="Lưu phân quyền">
        <span className={`o1-dirty${dirty ? " on" : ""}`} role="status">{dirty ? `${added.length + removed.length} thay đổi chưa lưu` : "Không có thay đổi"}</span>
        <button className="secondary" type="button" disabled={!dirty || busy} onClick={() => setDraft(new Set(saved))}>Hoàn tác</button>
        <button className="primary" type="button" disabled={!dirty || busy} onClick={() => { setSaveError(""); setConfirming(true); }}>Lưu thay đổi</button>
      </div>

      <section className="form-card o1-audit" aria-labelledby="o1-audit-title">
        <h2 id="o1-audit-title">Nhật ký phân quyền</h2>
        {auditError ? <p className="catalog-error" role="alert">{auditError}</p> : audit === null ? <CardSkeleton height={60} /> : audit.length === 0 ? <p className="meta">Chưa có thay đổi nào kể từ khi bật phân quyền.</p> : (
          <ol className="o1-audit-list">
            {audit.map((row) => (
              <li key={row.id}>
                <div className="o1-audit-head"><strong>{row.actorUsername ?? "Không rõ"}</strong><time dateTime={row.changedAt}>{formatDateTime(row.changedAt)}</time></div>
                {row.added.length ? <p><span className="o1-tag on">Bật</span>{row.added.map(label).join(", ")}</p> : null}
                {row.removed.length ? <p><span className="o1-tag off">Tắt</span>{row.removed.map(label).join(", ")}</p> : null}
                {!row.added.length && !row.removed.length ? <p className="meta">Dọn mã quyền không còn dùng.</p> : null}
              </li>
            ))}
          </ol>
        )}
      </section>

      <ConfirmDialog open={confirming} title="Lưu phân quyền Quản lý?" confirmLabel={busy ? "Đang lưu…" : "Lưu thay đổi"} busy={busy} error={saveError}
        message="Áp dụng cho mọi tài khoản Quản lý từ thao tác kế tiếp của họ."
        onConfirm={() => void save()} onClose={() => { if (!busy) setConfirming(false); }}>
        <div className="o1-diff">
          {added.length ? <div><p className="o1-diff-title"><span className="o1-tag on">Bật</span>{added.length} quyền</p><ul>{added.map((c) => <li key={c}>{label(c)}</li>)}</ul></div> : null}
          {removed.length ? <div><p className="o1-diff-title"><span className="o1-tag off">Tắt</span>{removed.length} quyền</p><ul>{removed.map((c) => <li key={c}>{label(c)}</li>)}</ul></div> : null}
        </div>
      </ConfirmDialog>
    </div>
  );
}
