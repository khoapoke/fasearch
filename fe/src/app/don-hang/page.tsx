"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { StorefrontShell } from "@/components/storefront/storefront-shell";
import "@/components/customer-auth/auth.css";
import ac from "@/components/account/account-cards.module.css";
import { PriceTag } from "@/components/storefront/price-tag";
import { fetchCustomerOrders } from "@/lib/customer-commerce-client";
import {
  CommerceError,
  orderStatusText,
  type CustomerOrder,
} from "@/lib/customer-commerce";

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
  if (Number.isNaN(d.getTime())) return "Chưa cập nhật";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function OrdersPage() {
  const router = useRouter();
  const [page, setPage] = useState(0);
  const [status, setStatus] = useState("");
  const [rows, setRows] = useState<CustomerOrder[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [errorStatus, setErrorStatus] = useState(0);

  const load = useCallback(async (nextPage: number, nextStatus: string) => {
    setLoading(true);
    setError("");
    try {
      const q = new URLSearchParams({ page: String(nextPage), size: "10" });
      if (nextStatus) q.set("status", nextStatus);
      const result = await fetchCustomerOrders(q.toString());
      setRows(result.items);
      setTotal(result.totalElements);
    } catch (failure) {
      const s = failure instanceof CommerceError ? failure.status : 0;
      setErrorStatus(s);
      if (s === 401) {
        router.replace(`/dang-nhap?next=${encodeURIComponent("/don-hang")}`);
        return;
      }
      setError(failure instanceof Error ? failure.message : "Không tải được danh sách đơn hàng.");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    void Promise.resolve().then(() => load(page, status));
  }, [load, page, status]);

  return (
    <StorefrontShell active="/tai-khoan" themed palette="customer" header="customer" footer="none">
      <div className="acctPage">
        <div className="acct-content">
          <nav className="sfCrumbs" aria-label="Đường dẫn">
            <Link href="/">Trang chủ</Link>
            <span aria-hidden="true">›</span>
            <Link href="/tai-khoan">Tài khoản</Link>
            <span aria-hidden="true">›</span>
            <span aria-current="page">Đơn hàng</span>
          </nav>
          <div className="acct-head">
            <h1>Đơn hàng của bạn</h1>
          </div>
          <div className={ac.pageWide}>
            <section className={ac.card} aria-labelledby="orders-list">
              <div className={ac.head}>
                <p className={ac.eyebrow}>01 · Đơn hàng</p>
                <h2 id="orders-list" className={ac.title}>Danh sách đơn</h2>
                <p className={ac.lead}>Theo dõi tiến độ và lịch sử đơn hàng của bạn.</p>
              </div>
              <div className={ac.toolbar} role="group" aria-label="Lọc trạng thái đơn">
                {FILTERS.map((f) => (
                  <button
                    key={f.value || "all"}
                    className={ac.pill}
                    type="button"
                    aria-pressed={status === f.value}
                    onClick={() => {
                      setStatus(f.value);
                      setPage(0);
                    }}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
              {loading ? (
                <div className={ac.group} role="status">
                  <div className={ac.skeleton} />
                  <div className={ac.skeleton} />
                  <p className={ac.meta}>Đang tải đơn hàng…</p>
                </div>
              ) : null}
              {error ? (
                <div role="alert">
                  <p className={ac.alert}>
                    {errorStatus === 403
                      ? "Khu vực này dành cho khách hàng mua sắm."
                      : error}
                  </p>
                  {errorStatus === 403 ? (
                    <p className={ac.meta}>Tài khoản của bạn hiện có vai trò Quản trị viên/Quản lý. Đơn mua hàng trực tuyến cá nhân chỉ hiển thị cho tài khoản Khách hàng. Bạn có thể mở trang Quản trị đơn hàng để quản lý toàn bộ đơn trong hệ thống.</p>
                  ) : null}
                  <div className={ac.actions}>
                    {errorStatus === 403 ? (
                      <>
                        <Link className={ac.primary} href="/quan-tri/don-hang">Đến Quản trị đơn hàng</Link>
                        <Link className={ac.secondary} href="/dang-nhap?next=%2Fdon-hang">Đăng nhập tài khoản Khách hàng</Link>
                      </>
                    ) : (
                      <button className={ac.secondary} type="button" onClick={() => load(page, status)}>
                        Thử lại
                      </button>
                    )}
                  </div>
                </div>
              ) : null}
              {!loading && !error && rows.length === 0 ? (
                <div className={`${ac.card} ${ac.empty}`} style={{ padding: "20px 22px" }}>
                  <p className={ac.meta}>Bạn chưa có đơn hàng nào.</p>
                  <div className={ac.actions}>
                    <Link className={ac.primary} href="/nam">Mua sắm ngay</Link>
                  </div>
                </div>
              ) : null}
              {!error && rows.length > 0 ? (
                <ul className={ac.list}>
                  {rows.map((order) => {
                    const code = order.orderCode || `Đơn hàng #${order.orderId}`;
                    return (
                      <li key={order.orderId}>
                        <span style={{ minWidth: 0 }}>
                          <Link className={ac.link} href={`/don-hang/${order.orderId}`} style={{ fontWeight: 650, fontSize: 14 }}>
                            {code}
                          </Link>
                          <span className={ac.meta} style={{ display: "block", marginTop: 4 }}>
                            {dateText(order.createdAt)}
                            {order.customerName ? ` · ${order.customerName}` : ""}
                          </span>
                          <span className={ac.meta} style={{ display: "block", marginTop: 2 }}>{order.deliveryAddress || "Chưa cập nhật"}</span>
                        </span>
                        <span style={{ display: "grid", justifyItems: "end", gap: 8, flex: "none" }}>
                          <span className={ac.chip}>{orderStatusText(order.status)}</span>
                          <PriceTag value={order.totalAmount} />
                          <Link className={ac.link} href={`/don-hang/${order.orderId}`}>
                            Chi tiết →
                          </Link>
                        </span>
                      </li>
                    );
                  })}
                </ul>
              ) : null}
              {total > 10 ? (
                <div className={ac.toolbar} style={{ alignItems: "center", justifyContent: "space-between" }}>
                  <button
                    className={ac.secondary}
                    type="button"
                    disabled={page === 0}
                    onClick={() => setPage((p) => Math.max(0, p - 1))}
                  >
                    ← Trước
                  </button>
                  <p className={ac.meta} style={{ flex: 1, margin: 0, textAlign: "center" }}>
                    Trang {page + 1} / {Math.ceil(total / 10)} · {total} đơn
                  </p>
                  <button
                    className={ac.secondary}
                    type="button"
                    disabled={page + 1 >= Math.ceil(total / 10)}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Sau →
                  </button>
                </div>
              ) : null}
            </section>
          </div>
        </div>
      </div>
    </StorefrontShell>
  );
}
