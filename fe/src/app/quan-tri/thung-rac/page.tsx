"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AdminShellB } from "@/components/admin-b/admin-shell";
import { Pager } from "@/components/admin-b/pagination";
import { ConfirmDialog } from "@/components/admin-b/confirm-dialog";
import { PageHeader } from "@/components/admin-b/page-header";
import { TableSkeleton } from "@/components/admin-b/skeleton";
import { useToast } from "@/components/admin-b/toast";
import { StatusBadge } from "@/components/admin-b/status-badge";
import { useAdminRole, useAdminCan } from "@/components/admin-b/use-admin-role";
import { roleLabel, statusLabel } from "@/lib/admin-people-client";
import { formatDateTime } from "@/lib/admin-format";
import {
  deletedByLabel,
  getTrashPage,
  restoreTrashItem,
  type TrashItem,
  type TrashKind,
  type TrashPage,
} from "@/lib/admin-trash-client";

const PAGE_SIZE = 20;
const STATUS_LABEL: Record<string, string> = {
  DRAFT: "Draft",
  ACTIVE: "Đang bán",
  OUT_OF_STOCK: "Tạm hết hàng",
  DISCONTINUED: "Ngừng kinh doanh",
};
const ALL_TABS: Array<{ kind: TrashKind; label: string; adminOnly: boolean }> = [
  { kind: "products", label: "Sản phẩm", adminOnly: false },
  { kind: "variants", label: "Biến thể", adminOnly: false },
  { kind: "categories", label: "Danh mục", adminOnly: false },
  { kind: "customers", label: "Khách hàng", adminOnly: false },
  { kind: "employees", label: "Nhân sự", adminOnly: false },
  { kind: "accounts", label: "Tài khoản", adminOnly: true },
];

const NOTE: Record<TrashKind, string> = {
  products:
    "Sản phẩm khôi phục ở trạng thái Ngừng kinh doanh và Chưa Publish — chưa bán lại được cho tới khi Publish lại qua Draft. Khôi phục sản phẩm chỉ khôi phục các SKU bị xóa cùng lúc với sản phẩm; SKU đã xóa riêng từ trước vẫn nằm trong thùng rác.",
  variants: "SKU thuộc một sản phẩm đang ở trong thùng rác thì phải khôi phục sản phẩm trước.",
  categories: "Danh mục chỉ xóa được khi không còn sản phẩm tham chiếu, kể cả sản phẩm đã xóa.",
  customers:
    "Khách hàng đã có đơn hàng, hóa đơn, bút toán điểm hoặc phiếu đổi trả thì không xóa được. Khôi phục hồ sơ không tự mở khóa tài khoản đăng nhập liên kết; Quản trị viên bật lại ở màn hình Tài khoản nội bộ.",
  employees:
    "Hồ sơ có tài khoản đăng nhập liên kết chỉ Quản trị viên hệ thống xóa được; hồ sơ của Quản trị viên hệ thống thì Quản lý không xóa được. Khôi phục hồ sơ không mở khóa tài khoản.",
  accounts:
    "Chỉ Quản trị viên hệ thống thấy tab này. Tài khoản khôi phục ở trạng thái Ngừng hoạt động và chưa đăng nhập được cho tới khi được bật Hoạt động.",
};

const CAPTION: Record<TrashKind, string> = {
  products: "Sản phẩm đã xóa",
  variants: "Biến thể đã xóa",
  categories: "Danh mục đã xóa",
  customers: "Khách hàng đã xóa",
  employees: "Hồ sơ nhân sự đã xóa",
  accounts: "Tài khoản đã xóa",
};

const EMPTY: Record<TrashKind, string> = {
  products: "sản phẩm",
  variants: "biến thể",
  categories: "danh mục",
  customers: "khách hàng",
  employees: "hồ sơ nhân sự",
  accounts: "tài khoản",
};

const UNIT: Record<TrashKind, string> = {
  products: "sản phẩm",
  variants: "SKU",
  categories: "danh mục",
  customers: "khách hàng",
  employees: "hồ sơ nhân sự",
  accounts: "tài khoản",
};

function itemName(item: TrashItem, kind: TrashKind): string {
  if (kind === "variants") {
    const variant = [item.color, item.size].filter(Boolean).join(" / ");
    return `${item.productName ?? "Không rõ"}${variant ? ` · ${variant}` : ""}`;
  }
  return item.name ?? "Không rõ";
}

function itemDetail(item: TrashItem, kind: TrashKind): string | null {
  if (kind === "variants") return item.barcode ? `Barcode ${item.barcode}` : null;
  if (kind === "customers" || kind === "employees") return item.phone ? `Điện thoại ${item.phone}` : null;
  if (kind === "accounts") return item.email ?? "Chưa có email";
  return null;
}

function restoreNotice(item: TrashItem, kind: TrashKind): string {
  if (kind === "products") {
    return `Đã khôi phục "${itemName(item, kind)}" ở trạng thái Ngừng kinh doanh và Chưa Publish. Sản phẩm chưa bán lại được cho tới khi Publish qua Draft.`;
  }
  if (kind === "accounts") {
    return `Đã khôi phục "${itemName(item, kind)}" ở trạng thái Ngừng hoạt động. Tài khoản chưa đăng nhập được cho tới khi Quản trị viên bật Hoạt động.`;
  }
  if (kind === "customers" || kind === "employees") {
    return `Đã khôi phục "${itemName(item, kind)}". Tài khoản đăng nhập liên kết (nếu có) giữ nguyên trạng thái khóa.`;
  }
  return `Đã khôi phục "${itemName(item, kind)}".`;
}

export default function AdminTrashPage() {
  const role = useAdminRole(); const can = useAdminCan();
  const tabs = useMemo(() => ALL_TABS.filter((tab) => !tab.adminOnly || role === "ADMIN"), [role]);
  const [kind, setKind] = useState<TrashKind>("products");
  const [page, setPage] = useState(0);
  const [data, setData] = useState<TrashPage | null>(null);
  const [error, setError] = useState("");
  const [refusal, setRefusal] = useState("");
  const [confirming, setConfirming] = useState<TrashItem | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const toast = useToast();
  const [counts, setCounts] = useState<Partial<Record<TrashKind, number>>>({});

  useEffect(() => {
    const controller = new AbortController();
    getTrashPage(kind, page, PAGE_SIZE, controller.signal)
      .then((next) => {
        if (controller.signal.aborted) return;
        setData(next);
        setError("");
      })
      .catch((failure) => {
        if (controller.signal.aborted) return;
        setError(failure instanceof Error ? failure.message : "Không tải được thùng rác.");
      });
    return () => controller.abort();
  }, [kind, page, reloadKey]);

  useEffect(() => {
    const controller = new AbortController();
    void Promise.all(tabs.map((tab) => getTrashPage(tab.kind, 0, 1, controller.signal).then((p) => [tab.kind, p.totalElements] as const).catch(() => null)))
      .then((pairs) => {
        if (controller.signal.aborted) return;
        const next: Partial<Record<TrashKind, number>> = {};
        for (const pair of pairs) if (pair) next[pair[0]] = pair[1];
        setCounts(next);
      });
    return () => controller.abort();
  }, [tabs, reloadKey]);

  const changeTab = useCallback((next: TrashKind) => {
    setKind(next);
    setPage(0);
    setData(null);
    setError("");
    setRefusal("");
    setConfirming(null);
  }, []);

  const changePage = useCallback((next: number) => {
    setPage(next);
    setData(null);
    setError("");
    setRefusal("");
    setConfirming(null);
  }, []);

  const retry = useCallback(() => {
    setData(null);
    setError("");
    setReloadKey((current) => current + 1);
  }, []);

  async function restore(item: TrashItem) {
    if (busyId !== null) return;
    setBusyId(item.id);
    setRefusal("");
    try {
      await restoreTrashItem(kind, item.id);
      setConfirming(null);
      toast.success(restoreNotice(item, kind));
      setReloadKey((current) => current + 1);
    } catch (failure) {
      setRefusal(
        failure instanceof Error && failure.message
          ? `Không khôi phục được "${itemName(item, kind)}": ${failure.message}`
          : `Không khôi phục được "${itemName(item, kind)}".`,
      );
    } finally {
      setBusyId(null);
    }
  }

  const rows = data?.content ?? [];
  const loading = data === null && error === "";
  const totalPages = Math.max(1, data?.totalPages ?? 1);
  const linkedNote = (item: TrashItem) => {
    if (!item.linkedUsername) return null;
    return `Tài khoản liên kết: ${item.linkedUsername} · ${item.linkedAccountStatus ? statusLabel(item.linkedAccountStatus) : "Không rõ"}`;
  };

  return (
    <AdminShellB active="trash" title="Thùng rác">
      <PageHeader title="Thùng rác" hint={<>Dữ liệu xóa mềm vẫn còn nguyên trong hệ thống để bảo toàn lịch sử. Chỉ có khôi phục, không có xóa vĩnh viễn. {NOTE[kind]}</>} />

      <div className="l3-tabs" role="tablist" aria-label="Loại dữ liệu trong thùng rác">
        {tabs.map((tab) => (
          <button
            key={tab.kind}
            type="button"
            role="tab"
            id={`trash-tab-${tab.kind}`}
            aria-selected={kind === tab.kind}
            aria-controls={`trash-panel-${tab.kind}`}
            onClick={() => changeTab(tab.kind)}
          >
            {tab.label}
            {counts[tab.kind] !== undefined ? <span className={`l3-tab-count${counts[tab.kind] ? "" : " zero"}`}>{counts[tab.kind]}</span> : null}
          </button>
        ))}
      </div>

      {error ? (
        <div className="catalog-error" role="alert">
          <p>{error}</p>
          <button className="secondary" type="button" onClick={retry}>
            Thử lại
          </button>
        </div>
      ) : null}
      {refusal && !confirming ? <p className="catalog-error" role="alert">{refusal}</p> : null}

      <ConfirmDialog
        open={confirming !== null}
        title={`Khôi phục ${UNIT[kind]}?`}
        message={confirming ? `${itemName(confirming, kind)}${kind === "products"
          ? " sẽ trở lại danh sách ở trạng thái Ngừng kinh doanh và Chưa Publish, không tự hiện trên cửa hàng hay tìm kiếm AI."
          : kind === "accounts"
            ? " sẽ trở lại danh sách ở trạng thái Ngừng hoạt động; phải bật Hoạt động thì mới đăng nhập được."
            : kind === "customers" || kind === "employees"
              ? " sẽ trở lại danh sách làm việc; tài khoản đăng nhập liên kết không được mở khóa."
              : " sẽ trở lại danh sách làm việc."}` : ""}
        confirmLabel="Khôi phục"
        busy={busyId !== null}
        error={confirming ? refusal : ""}
        onConfirm={() => { if (confirming) void restore(confirming); }}
        onClose={() => { if (busyId === null) { setConfirming(null); setRefusal(""); } }}
      />

      {loading ? <TableSkeleton rows={6} columns={6} /> : null}

      {rows.length > 0 ? (
      <div
        className="table-scroll sticky-head review-table-scroll table-cards"
        tabIndex={0}
        id={`trash-panel-${kind}`}
        role="tabpanel"
        aria-labelledby={`trash-tab-${kind}`}
      >
        <table className="review-orders-table trash-table l3-table">
          <caption className="sr-only">
            {CAPTION[kind]} · mới xóa trước
          </caption>
          <thead>
            <tr>
              <th>Tên</th>
              <th>Xóa lúc</th>
              <th>Người xóa</th>
              <th>Lý do</th>
              <th>Trạng thái</th>
              <th className="num">Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((item) => {
              const detail = itemDetail(item, kind);
              const linked = linkedNote(item);
              return (
                <tr key={`${kind}-${item.id}`}>
                  <td data-label="Tên" className="cell-title">
                    {itemName(item, kind)}
                    {detail ? <small className="product-name">{detail}</small> : null}
                  </td>
                  <td data-label="Xóa lúc" className="cell-date">{item.deletedAt ? formatDateTime(item.deletedAt) : "Không rõ"}</td>
                  <td data-label="Người xóa">{deletedByLabel(item.deletedBy)}</td>
                  <td data-label="Lý do">{item.deleteReason?.trim() ? <span className="l3-clip" title={item.deleteReason}>{item.deleteReason}</span> : <span className="empty-value">Không rõ</span>}</td>
                  <td data-label="Trạng thái">
                    {kind === "products" ? (
                      <StatusBadge status={item.status} label={STATUS_LABEL[item.status ?? ""] ?? item.status ?? "Không rõ"} />
                    ) : kind === "variants" ? (
                      item.parentDeleted ? <span className="badge t-amber">Sản phẩm đang bị xóa</span> : <span className="badge t-gray">SKU đã xóa</span>
                    ) : kind === "accounts" ? (
                      <>
                        <span className="badge t-gray">{statusLabel(item.status ?? "DELETED")}</span>
                        <small className="product-name">{item.role ? roleLabel(item.role) : "Không rõ vai trò"}</small>
                      </>
                    ) : (
                      <>
                        <span className="badge t-gray">Hồ sơ đã xóa</span>
                        {linked ? <small className="product-name">{linked}</small> : null}
                      </>
                    )}
                  </td>
                  <td data-label="Thao tác" className="num">
                    <div className="row-actions end">
                      {can("TRASH_RESTORE") ? <button
                        className="secondary btn-sm"
                        type="button"
                        disabled={busyId !== null}
                        onClick={() => {
                          setRefusal("");
                          setConfirming(item);
                        }}
                      >
                        Khôi phục
                      </button> : <span className="meta">Chỉ xem</span>}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      ) : null}

      {!loading && rows.length === 0 && !error ? (
        <div className="l3-empty" role="status">
          <strong>Thùng rác trống</strong>
          <span>Chưa có {EMPTY[kind]} nào bị xóa.</span>
        </div>
      ) : null}
      {(data?.totalElements ?? 0) > 0 ? (
        <Pager page={data?.pageNumber ?? 0} totalPages={totalPages} total={data?.totalElements ?? 0} unit="mục" onPage={changePage} busy={loading} />
      ) : null}
    </AdminShellB>
  );
}
