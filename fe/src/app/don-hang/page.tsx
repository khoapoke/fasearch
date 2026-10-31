"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { StorefrontShell } from "@/components/storefront/storefront-shell";
import { fetchCustomerOrders } from "@/lib/customer-commerce-client";
import { CommerceError, formatMoney, orderStatusText, type CustomerOrder } from "@/lib/customer-commerce";
import "@/components/customer-commerce/commerce.css";

const FILTERS: Array<{ value: string; label: string }> = [
  { value: "", label: "Tất cả" },
  { value: "PENDING", label: "Chờ xác nhận" },
  { value: "CONFIRMED", label: "Đã xác nhận" },
  { value: "PACKING", label: "Đang đóng gói" },
  { value: "SHIPPING", label: "Đang giao" },
  { value: "COMPLETED", label: "Hoàn thành" },
  { value: "CANCELLED", label: "Đã hủy" },
];

function dateText(value: string): string {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : new Intl.DateTimeFormat("vi-VN", { dateStyle: "medium", timeStyle: "short" }).format(d);
}

export default function OrdersPage() {
  const [page, setPage] = useState(0);
  const [status, setStatus] = useState("");
  const [rows, setRows] = useState<CustomerOrder[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [errorStatus, setErrorStatus] = useState(0);

  const load = useCallback(async (nextPage: number, nextStatus: string) => {
    setLoading(true); setError("");
    try {
      const q = new URLSearchParams({ page: String(nextPage), size: "10" });
      if (nextStatus) q.set("status", nextStatus);
      const result = await fetchCustomerOrders(q.toString());
      setRows(result.items); setTotal(result.totalElements);
    } catch (failure) {
      setErrorStatus(failure instanceof CommerceError ? failure.status : 0);
      setError(failure instanceof Error ? failure.message : "Không tải được đơn hàng.");
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void Promise.resolve().then(() => load(page, status)); }, [load, page, status]);

  return (
    <StorefrontShell active="/tai-khoan" themed palette="customer" header="customer" footer="none">
      <div className="commercePage">
        <div className="commerce-content">
          <nav className="commerce-crumbs" aria-label="Đường dẫn"><Link href="/tai-khoan">Tài khoản</Link><span aria-hidden="true">›</span><span aria-current="page">Đơn hàng</span></nav>
          <h1 className="commerce-title">Đơn hàng</h1>
          <p className="commerce-sub">Đơn của chính tài khoản đang đăng nhập, lấy từ máy chủ thử nghiệm. Không có dữ liệu đơn mẫu.</p>
          <div className="commerce-toolbar" role="group" aria-label="Lọc trạng thái đơn">
            {FILTERS.map((f) => (
              <button key={f.value || "all"} className="commerce-ghost" type="button" aria-pressed={status === f.value} onClick={() => { setStatus(f.value); setPage(0); }} style={{ fontWeight: status === f.value ? 600 : 400, color: status === f.value ? "var(--st-ink)" : undefined }}>{f.label}</button>
            ))}
          </div>
          {loading ? <p className="commerce-status" role="status">Đang tải đơn hàng…</p> : null}
          {error ? <div className="commerce-empty" role="alert"><h2>Không tải được đơn hàng</h2><p>{error}{errorStatus === 401 ? <> <Link className="commerce-link" href="/dang-nhap?next=%2Ftai-khoan">Đăng nhập →</Link></> : null}</p><button className="commerce-ghost" type="button" onClick={() => load(page, status)}>Thử lại (giữ lọc)</button></div> : null}
          {!loading && !error && rows.length === 0 ? <div className="commerce-empty"><h2>Chưa có đơn ở trạng thái này</h2><p>Đơn thật sẽ xuất hiện sau khi tạo ở bước thanh toán thử nghiệm.</p><Link className="commerce-link" href="/gio-hang">Mở giỏ hàng →</Link></div> : null}
          {!error && rows.length > 0 ? (
            <ul className="commerce-lines">
              {rows.map((order) => (
                <li className="commerce-line" key={order.orderId} style={{ gridTemplateColumns: "minmax(0,1fr) auto" }}>
                  <div>
                    <p className="commerce-line-name"><Link className="commerce-link" href={`/don-hang/${order.orderId}`}>{order.orderCode}</Link></p>
                    <p className="commerce-line-meta">{dateText(order.createdAt)} · {orderStatusText(order.status)} · {order.customerName ?? "—"}</p>
                    <p className="commerce-line-meta">{order.deliveryAddress ?? "—"}</p>
                  </div>
                  <div className="commerce-line-side"><strong className="commerce-line-total">{formatMoney(order.totalAmount)}</strong><Link className="commerce-link" href={`/don-hang/${order.orderId}`}>Chi tiết →</Link></div>
                </li>
              ))}
            </ul>
          ) : null}
          {total > 10 ? <div className="commerce-toolbar"><button className="commerce-ghost" type="button" disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>← Trước</button><p>Trang {page + 1} · {total} đơn</p><button className="commerce-ghost" type="button" disabled={page + 1 >= Math.ceil(total / 10)} onClick={() => setPage((p) => p + 1)}>Sau →</button></div> : null}
          <p className="commerce-note">Chỉ hiển thị trạng thái và tổng tiền do BE trả về. Không có nút đổi trạng thái của nhân viên trong khu vực khách hàng.</p>
        </div>
      </div>
    </StorefrontShell>
  );
}
