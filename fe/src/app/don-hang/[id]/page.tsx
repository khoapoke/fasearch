"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { AccountCenterShell } from "@/components/storefront/account-center-shell";
import { cancelOwnOrder, fetchOwnOrder } from "@/lib/commerce-client";
import {
  commerceErrorMessage, formatVndContract, isCustomerCancellable, newOperationKey,
  orderStatusLabel, paymentMethodLabel, paymentStatusLabel, validateCancelReason,
  type OrderDetail,
} from "@/lib/commerce";
import "@/components/storefront/preview.css";

function OrderDiscountLines({ order }: { order: OrderDetail }) {
  // giamGia equals voucher+points summed per line here; show it only when no split lines exist.
  const hasSplit = (order.giamVoucher ?? 0) > 0 || (order.giamDiem ?? 0) > 0
    || (order.maVoucher ?? 0) > 0 || (order.diemSuDung ?? 0) > 0;
  if (hasSplit) return null;
  if (!((order.giamGia ?? 0) > 0)) return null;
  return (
    <div className="pvLine"><span>Giảm giá</span><span>−{formatVndContract(order.giamGia)}</span></div>
  );
}

export default function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const [id, setId] = useState<string>("");
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [status, setStatus] = useState(0);
  const [reason, setReason] = useState("");
  const [cancelling, setCancelling] = useState(false);
  const [opKey, setOpKey] = useState(() => newOperationKey());
  const busyRef = useRef(false);
  const errorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    params.then((p) => setId(p.id));
  }, [params]);

  // Tiêu điểm về thông báo lỗi sau khi React đã gắn node: gọi focus() ngay sau
  // setError sẽ là no-op vì node lỗi còn chưa tồn tại.
  useEffect(() => {
    if (error) errorRef.current?.focus();
  }, [error]);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError("");
    try {
      const o = await fetchOwnOrder(id);
      setOrder(o);
    } catch (e) {
      const st = (e as { status?: number })?.status ?? 0;
      setStatus(st);
      setError(commerceErrorMessage(st, e instanceof Error ? e.message : "Không tải được đơn."));

    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (!id) return;
    void Promise.resolve().then(() => load());
  }, [id, load]);

  async function cancel() {
    if (!order || busyRef.current) return;
    let r: string;
    try {
      r = validateCancelReason(reason);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Lý do hủy chưa hợp lệ.");

      return;
    }
    busyRef.current = true;
    setCancelling(true);
    setError("");
    try {
      const next = await cancelOwnOrder(order.maDonHang, { khoaTam: opKey, phienBan: order.phienBan, lyDo: r });
      setOrder(next);
      setReason("");
      setOpKey(newOperationKey());
    } catch (e) {
      const st = (e as { status?: number })?.status ?? 0;
      setStatus(st);
      if (st === 409) {
        setError(`${commerceErrorMessage(st, e instanceof Error ? e.message : "")} Đơn đã đổi — tải lại rồi thử lại với khóa mới.`);
        setOpKey(newOperationKey());
        try {
          const fresh = await fetchOwnOrder(order.maDonHang);
          setOrder(fresh);
        } catch {
          /* keep */
        }
      } else {
        setError(commerceErrorMessage(st, e instanceof Error ? e.message : "Hủy thất bại."));
      }

    } finally {
      busyRef.current = false;
      setCancelling(false);
    }
  }

  return (
    <AccountCenterShell active="/tai-khoan" title={id ? `Đơn #${id}` : "Chi tiết đơn"}>
      <p><Link href="/don-hang">← Về danh sách đơn</Link></p>
      {loading ? <p className="pgState" role="status"><strong>Đang tải đơn thật…</strong></p> : null}
      {error ? (
        <div ref={errorRef} tabIndex={-1} className="pvCard" role="alert">
          <p className="sub">{error} {status === 401 ? <Link href={`/dang-nhap?next=/don-hang/${id}`}>Đăng nhập →</Link> : null}</p>
          <button className="hmCta hmCtaGhost" type="button" onClick={load}>Thử lại</button>
        </div>
      ) : null}
      {order ? (
        <section className="sfSideCard" aria-label={`Đơn ${order.maDonHang}`}>
          <div style={{ display: "flex", gap: 10, alignItems: "baseline", flexWrap: "wrap" }}>
            <b>Mã đơn: #{order.maDonHang}</b>
            <span className="pMatch">{orderStatusLabel(order.trangThai)}</span>
            <span className="pPrice" style={{ marginLeft: "auto" }}>{formatVndContract(order.tongThanhToan)}</span>
          </div>
          <p className="sfIdentitySub">
            Kênh {order.kenhBan} · Kho {order.maKho} · Đặt {order.ngayDat} · Phiên bản {order.phienBan}
          </p>
          <p className="sfIdentitySub">
            Người nhận: {order.nguoiNhan ?? "—"} · {order.sdtNhan ?? "—"} · {order.diaChiGiao ?? "—"}
          </p>
          <p className="sfIdentitySub">
            {paymentMethodLabel(order.phuongThucThanhToan)} · {paymentStatusLabel(order.trangThaiThanhToan)}
            {order.maHoaDon ? ` · Hóa đơn ${order.maHoaDon}` : ""}
          </p>
          {order.items.map((l) => (
            <div className="pvRow" key={l.maSku}>
              <div style={{ flex: 1 }}>
                <b className="name">{l.tenSpSnapshot}</b>
                <small>SKU {l.maSku} · SP {l.maSp} · {[l.mauSacSnapshot, l.kichCoSnapshot].filter(Boolean).join(" · ")} · SL: {l.soLuong}{(l.tienGiamGia ?? 0) > 0 ? ` · giảm ${formatVndContract(l.tienGiamGia)}` : ""}</small>
              </div>
              <b>{formatVndContract(l.tongDong)}</b>
            </div>
          ))}
          <div className="pvLine"><span>Tạm tính</span><span>{formatVndContract(order.tongTienHang)}</span></div>
          <OrderDiscountLines order={order} />
          {(order.giamVoucher ?? 0) > 0 || (order.maVoucher ?? 0) > 0 ? (
            <div className="pvLine"><span>Voucher #{order.maVoucher ?? ""} (đã chốt)</span><span>−{formatVndContract(order.giamVoucher ?? 0)}</span></div>
          ) : null}
          {(order.giamDiem ?? 0) > 0 || (order.diemSuDung ?? 0) > 0 ? (
            <div className="pvLine"><span>Điểm đã dùng ({order.diemSuDung ?? 0}) (đã chốt)</span><span>−{formatVndContract(order.giamDiem ?? 0)}</span></div>
          ) : null}
          <div className="pvLine"><span>Phí vận chuyển</span><span>{formatVndContract(order.phiVanChuyen)}</span></div>
          <div className="pvLine total"><span>Tổng thanh toán</span><span>{formatVndContract(order.tongThanhToan)}</span></div>
          <h3 style={{ marginTop: 12 }}>Lịch sử thật</h3>
          {order.lichSu.length === 0 ? <p className="sfIdentitySub">Chưa có lịch sử.</p> : (
            <ul style={{ fontSize: 13 }}>
              {order.lichSu.map((h, k) => (
                <li key={k}>{orderStatusLabel(h.trangThai)} · {h.thoiGian}{h.nguoiThucHien ? ` · ${h.nguoiThucHien}` : ""}</li>
              ))}
            </ul>
          )}
          {isCustomerCancellable(order) ? (
            <div style={{ marginTop: 12 }}>
              <h3>Hủy đơn của tôi (chỉ khi Mới tạo)</h3>
              <div className="pvField">
                <label htmlFor="cancel-reason">Lý do hủy</label>
                <input id="cancel-reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Đổi ý, đặt nhầm…" />
              </div>
              <button className="hmCta hmCtaGhost" type="button" disabled={cancelling} onClick={cancel}>
                {cancelling ? "Đang hủy…" : "Hủy đơn (giữ hàng hoàn về kho)"}
              </button>
            </div>
          ) : (
            <p className="sfIdentitySub" style={{ marginTop: 12 }}>
              {order.trangThai === "MOI_TAO"
                ? "Đơn mới tạo nhưng máy chủ không cho phép bạn hủy — liên hệ cửa hàng."
                : "Đơn đã qua giai đoạn cho phép khách tự hủy."}
            </p>
          )}
        </section>
      ) : null}
    </AccountCenterShell>
  );
}
