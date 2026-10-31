"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AccountCenterShell } from "@/components/storefront/account-center-shell";
import { fetchOwnOrders, withSessionRetry } from "@/lib/commerce-client";
import { orderStatusLabel } from "@/lib/commerce";
import { fetchFavorites } from "@/lib/customer-account-client";
import "@/components/storefront/listing.css";

type OwnOrder = {
  maDonHang: number;
  trangThai: string;
  ngayDat: string;
  tongThanhToan: number;
  tongTienHang: number;
  giamGia: number;
};

type OrdersState =
  | { kind: "loading" }
  | { kind: "ready"; orders: OwnOrder[] }
  | { kind: "error"; message: string };

// Tài khoản dùng dữ liệu thật của API đơn hàng; không có đơn thì báo rõ,
// không dựng thẻ đơn giả lập.
export function HubContent() {
  const [state, setState] = useState<OrdersState>({ kind: "loading" });
  const [savedCount, setSavedCount] = useState(0);

  useEffect(() => {
    let active = true;
    withSessionRetry(() => fetchOwnOrders("page=0&size=3"))
      .then((pg) => {
        if (active) setState({ kind: "ready", orders: pg.data as OwnOrder[] });
      })
      .catch((e) => {
        if (!active) return;
        const status = (e as { status?: number })?.status ?? 0;
        setState({
          kind: "error",
          message: status === 401
            ? "Phiên đăng nhập đã hết hiệu lực. Đăng nhập lại để xem đơn hàng."
            : "Không tải được danh sách đơn hàng. Thử lại sau.",
        });
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    fetchFavorites(0, 1).then((pg) => { if (active) setSavedCount(pg.totalElements); }).catch(() => {});
    return () => { active = false; };
  }, []);
  const savedProductCount = savedCount;
  const latest = state.kind === "ready" ? state.orders[0] ?? null : null;

  return (
    <AccountCenterShell active="/tai-khoan" title="Tài khoản của tôi">
      <section className="sfSideCard" aria-label="Đơn hàng gần đây">
        <div style={{ display: "flex", alignItems: "baseline" }}>
          <b>Đơn hàng gần đây</b>
          <Link href="/don-hang" style={{ marginLeft: "auto", fontSize: 12.5, fontWeight: 700, color: "var(--accent)" }}>Xem tất cả →</Link>
        </div>
        {state.kind === "loading" ? (
          <p className="sfIdentitySub" role="status" style={{ marginTop: 8 }}>Đang tải đơn hàng…</p>
        ) : null}
        {state.kind === "error" ? (
          <p className="sfIdentitySub" role="alert" style={{ marginTop: 8, color: "#b42318" }}>{state.message}</p>
        ) : null}
        {state.kind === "ready" && !latest ? (
          <p className="sfIdentitySub" style={{ marginTop: 8 }}>
            Bạn chưa có đơn hàng nào. <Link href="/hang-moi">Xem hàng mới →</Link>
          </p>
        ) : null}
        {latest ? (
          <div style={{ marginTop: 10 }}>
            <div style={{ display: "flex", gap: 10, alignItems: "baseline", flexWrap: "wrap" }}>
              <b>Đơn #{latest.maDonHang}</b>
              <span className="pMatch">{orderStatusLabel(latest.trangThai)}</span>
              <span className="pPrice" style={{ marginLeft: "auto" }}>
                {latest.tongThanhToan.toLocaleString("vi-VN")}₫
              </span>
            </div>
            <p className="sfIdentitySub" style={{ marginTop: 6 }}>
              Đặt ngày {new Date(latest.ngayDat).toLocaleDateString("vi-VN")}
              {latest.giamGia > 0 ? ` · giảm ${latest.giamGia.toLocaleString("vi-VN")}₫` : ""}
            </p>
            <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
              <Link className="hmCta hmCtaGhost" href={`/don-hang/${latest.maDonHang}`} style={{ padding: "10px 16px", fontSize: 13 }}>Chi tiết đơn</Link>
              <Link className="hmCta hmCtaPrimary" href="/don-hang" style={{ padding: "10px 16px", fontSize: 13 }}>Theo dõi hành trình</Link>
            </div>
          </div>
        ) : null}
      </section>

      <section className="sfSideCard" aria-label="Sản phẩm yêu thích">
        <div style={{ display: "flex", alignItems: "baseline" }}>
          <b>Sản phẩm yêu thích</b>
          <Link href="/yeu-thich" style={{ marginLeft: "auto", fontSize: 12.5, fontWeight: 700, color: "var(--accent)" }}>Xem tất cả →</Link>
        </div>
        <p className="sfIdentitySub" style={{ marginTop: 8 }}>
          {savedProductCount > 0
            ? `Bạn đã lưu ${savedProductCount} sản phẩm trên thiết bị này.`
            : "Chưa lưu sản phẩm nào trên thiết bị này."}
        </p>
      </section>

      <section className="sfSideCard" aria-label="Lịch sử tìm kiếm AI">
        <b>Lịch sử tìm kiếm AI</b>
        <p className="sfIdentitySub" style={{ marginTop: 6 }}>
          Lịch sử tìm kiếm bằng AI được mở ở trang lịch sử riêng.
        </p>
        <p style={{ marginTop: 10 }}><Link href="/lich-su-ai" style={{ fontWeight: 700, color: "var(--accent)", fontSize: 13 }}>Mở lịch sử AI →</Link></p>
      </section>
    </AccountCenterShell>
  );
}
