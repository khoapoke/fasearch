"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { StorefrontShell } from "@/components/storefront/storefront-shell";
import { useCustomerCart } from "@/components/customer-commerce/customer-cart-provider";
import { readCart, writeCart, type CartItem as GuestItem } from "@/components/storefront/storefront-client";
import { addCustomerCartItem, removeCustomerCartItem, updateCustomerCartItem, clearCustomerCart } from "@/lib/customer-commerce-client";
import { CommerceError, formatMoney, type CustomerCart } from "@/lib/customer-commerce";
import "@/components/customer-commerce/commerce.css";

type GuestLine = GuestItem & { skuId?: number; color?: string; size?: string };

function guestCount(lines: GuestLine[]): number {
  return lines.reduce((sum, line) => sum + (line.qty || 0), 0);
}

export default function CartPage() {
  const { cart, setCart, refresh, loading, authState, error: loadError } = useCustomerCart();
  const [guest, setGuest] = useState<GuestLine[]>([]);
  const [busy, setBusy] = useState<number | "clear" | null>(null);
  const [notice, setNotice] = useState("");
  const [actionError, setActionError] = useState("");
  const pending = useRef(false);
  const imported = useRef(false);

  useEffect(() => {
    if (authState === "guest") void Promise.resolve().then(() => setGuest(readCart() as GuestLine[]));
  }, [authState]);

  const importGuest = useCallback(async () => {
    if (authState !== "authenticated" || imported.current) return;
    imported.current = true;
    const local = (readCart() as GuestLine[]).filter((line) => typeof line.skuId === "number" && line.skuId > 0);
    if (!local.length) return;
    let next: CustomerCart | null = cart;
    let ok = 0;
    for (const line of local) {
      try {
        next = await addCustomerCartItem(line.skuId as number, Math.min(999, Math.max(1, line.qty || 1)));
        ok += 1;
        writeCart((readCart() as GuestLine[]).filter((entry) => entry.skuId !== line.skuId));
      } catch {
        // Keep the exact failed guest line visible; never claim it synced.
      }
    }
    if (next) setCart(next);
    if (ok) setNotice(`Đã đồng bộ ${ok} món đã chọn SKU từ giỏ trình duyệt vào giỏ máy chủ.`);
  }, [authState, cart, setCart]);

  useEffect(() => { void Promise.resolve().then(() => importGuest()); }, [importGuest]);

  async function mutate(skuId: number, operation: "set" | "remove", quantity = 1) {
    if (pending.current) return;
    pending.current = true;
    setBusy(operation === "remove" ? skuId : skuId);
    setActionError("");
    setNotice("");
    try {
      const next = operation === "remove"
        ? await removeCustomerCartItem(skuId)
        : await updateCustomerCartItem(skuId, quantity);
      setCart(next);
    } catch (failure) {
      const status = failure instanceof CommerceError ? failure.status : 0;
      const message = failure instanceof Error ? failure.message : "Không cập nhật được giỏ hàng.";
      setActionError(message + (status === 409 ? " Giỏ đã thay đổi trên máy chủ; tải lại để xem số lượng thật." : ""));
      if (status === 409) await refresh();
    } finally {
      pending.current = false;
      setBusy(null);
    }
  }

  async function clear() {
    if (pending.current) return;
    pending.current = true;
    setBusy("clear");
    setActionError("");
    try {
      await clearCustomerCart();
      // DELETE success is the server confirmation; render the confirmed empty
      // state directly instead of racing a background cart refetch.
      setCart(cart ? { cartId: cart.cartId, totalItems: 0, subTotal: 0, items: [] } : null);
      setNotice("Đã xóa toàn bộ giỏ trên máy chủ.");
    } catch (failure) {
      setActionError(failure instanceof Error ? failure.message : "Không xóa được giỏ hàng.");
    } finally {
      pending.current = false;
      setBusy(null);
    }
  }

  const lines = cart?.items ?? [];
  const subtotal = cart?.subTotal ?? 0;

  return (
    <StorefrontShell active="/gio-hang" themed palette="customer" header="customer" footer="none">
      <div className="commercePage">
        <div className="commerce-content">
          <nav className="commerce-crumbs" aria-label="Đường dẫn">
            <Link href="/">Trang chủ</Link><span aria-hidden="true">›</span><span aria-current="page">Giỏ hàng</span>
          </nav>
          <h1 className="commerce-title">Giỏ hàng</h1>
          <p className="commerce-sub">Giá, số lượng và tổng tiền được máy chủ giỏ hàng xác nhận; không dùng tổng do trình duyệt tự tính.</p>

          {notice ? <p className="commerce-status" role="status">{notice}</p> : null}
          {actionError ? <p className="commerce-status is-error" role="alert">{actionError}</p> : null}

          {authState === "checking" || (authState === "authenticated" && loading && !cart) ? <p className="commerce-status" role="status">Đang tải giỏ hàng từ máy chủ…</p> : null}
          {authState === "error" ? (
            <div className="commerce-empty" role="alert">
              <h2>{loadError.includes("quyền") ? "Khu vực mua sắm dành cho khách hàng" : "Không tải được giỏ hàng"}</h2>
              <p>{loadError.includes("quyền")
                ? "Tài khoản của bạn hiện có vai trò Quản trị viên/Nhân viên nên không thể sử dụng giỏ hàng mua sắm. Vui lòng đăng nhập bằng tài khoản Khách hàng để mua hàng hoặc quay lại trang Quản trị."
                : loadError}</p>
              <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap", marginTop: 12 }}>
                {loadError.includes("quyền") ? (
                  <>
                    <Link className="commerce-primary" href="/quan-tri">Đến trang Quản trị →</Link>
                    <Link className="commerce-ghost" href="/dang-nhap?next=%2Fgio-hang">Đăng nhập tài khoản Khách hàng</Link>
                  </>
                ) : (
                  <button className="commerce-ghost" type="button" onClick={() => refresh()}>Thử lại</button>
                )}
              </div>
            </div>
          ) : null}

          {authState === "guest" ? (
            <div className="commerce-layout">
              <section className="commerce-panel" aria-label="Giỏ nháp trên trình duyệt">
                <div className="commerce-toolbar"><p>Giỏ nháp trên thiết bị này · chưa phải giỏ máy chủ</p><span>{guestCount(guest)} món</span></div>
                {guest.length === 0 ? (
                  <div className="commerce-empty"><h2>Giỏ đang trống</h2><p>Chọn màu và kích thước ở trang sản phẩm để thêm món.</p><Link className="commerce-link" href="/nam">Xem sản phẩm →</Link></div>
                ) : (
                  <ul className="commerce-lines commerce-guest">
                    {guest.map((line) => (
                      <li className="commerce-line" key={`${line.id}-${line.meta ?? ""}`}>
                        <div><p className="commerce-line-name"><Link className="commerce-link" href={`/san-pham/${line.id}`}>{line.name}</Link></p><p className="commerce-line-meta">{line.meta ?? "Chưa rõ biến thể"} · SL {line.qty}</p><p className="commerce-line-price">{formatMoney(line.price * line.qty)}</p></div>
                        <button className="commerce-remove" type="button" onClick={() => { const next = guest.filter((item) => item !== line); setGuest(next); writeCart(next as GuestItem[]); }}>Xóa</button>
                      </li>
                    ))}
                  </ul>
                )}
                <p className="commerce-note">Đăng nhập để chuyển các món đã chọn SKU vào giỏ máy chủ. Món chưa rõ SKU sẽ không tự đoán biến thể.</p>
                <Link className="commerce-primary" href="/dang-nhap?next=%2Fgio-hang">Đăng nhập để dùng giỏ máy chủ →</Link>
              </section>
              <aside className="commerce-summary" aria-label="Tóm tắt giỏ nháp">
                <h2>Chưa có tổng máy chủ</h2>
                <p className="commerce-note">Tổng tiền chỉ xuất hiện sau khi đăng nhập và tải giỏ thật. Giỏ nháp không được gửi đi như một đơn hàng.</p>
              </aside>
            </div>
          ) : null}

          {authState === "authenticated" && cart ? (
            <div className="commerce-layout">
              <section className="commerce-panel" aria-label="Sản phẩm trong giỏ máy chủ">
                <div className="commerce-toolbar"><p>Máy chủ xác nhận · cập nhật theo tồn kho hiện tại</p><span>{cart.totalItems} món</span></div>
                {lines.length === 0 ? (
                  <div className="commerce-empty"><h2>Giỏ đang trống</h2><p>Thêm sản phẩm từ trang chi tiết để bắt đầu.</p><Link className="commerce-link" href="/nam">Xem sản phẩm →</Link></div>
                ) : (
                  <ul className="commerce-lines">
                    {lines.map((line) => (
                      <li className="commerce-line" key={line.skuId}>
                        {line.imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element -- product image comes from the candidate BE
                          <img className="commerce-line-image" src={line.imageUrl} alt="" referrerPolicy="no-referrer" />
                        ) : <span className="commerce-line-image" aria-hidden="true" />}
                        <div>
                          <p className="commerce-line-name">{line.productName}</p>
                          <p className="commerce-line-meta">{[line.color, line.size].filter(Boolean).join(" · ") || "—"} · Đơn giá {formatMoney(line.unitPrice)}</p>
                          <p className="commerce-line-price">SKU {line.skuId}</p>
                        </div>
                        <div className="commerce-line-side">
                          <strong className="commerce-line-total">{formatMoney(line.totalPrice)}</strong>
                          <div className="commerce-stepper" aria-label={`Số lượng ${line.productName}`}>
                            <button type="button" disabled={busy !== null} aria-label={`Giảm ${line.productName}`} onClick={() => line.quantity > 1 ? mutate(line.skuId, "set", line.quantity - 1) : mutate(line.skuId, "remove")}>−</button>
                            <span aria-live="polite">{busy === line.skuId ? "…" : line.quantity}</span>
                            <button type="button" disabled={busy !== null} aria-label={`Tăng ${line.productName}`} onClick={() => mutate(line.skuId, "set", line.quantity + 1)}>+</button>
                          </div>
                          <button className="commerce-remove" type="button" disabled={busy !== null} onClick={() => mutate(line.skuId, "remove")}>Xóa</button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
                {lines.length ? <button className="commerce-ghost" type="button" disabled={busy !== null} onClick={clear}>{busy === "clear" ? "Đang xóa…" : "Xóa toàn bộ giỏ"}</button> : null}
              </section>
              <aside className="commerce-summary" aria-label="Tóm tắt giỏ máy chủ">
                <h2>Tóm tắt</h2>
                <div className="commerce-summary-row"><span>Tạm tính</span><strong>{formatMoney(subtotal)}</strong></div>
                <div className="commerce-summary-row"><span>Số món</span><strong>{cart.totalItems}</strong></div>
                <div className="commerce-summary-total"><span>Tổng hàng</span><strong>{formatMoney(subtotal)}</strong></div>
                <Link className="commerce-primary" href="/thanh-toan" aria-disabled={lines.length === 0}>Tiến hành thanh toán →</Link>
                <p className="commerce-note">Phí giao hàng được tính ở bước thanh toán bằng API vận chuyển; chưa cộng vào giỏ này.</p>
              </aside>
            </div>
          ) : null}
        </div>
      </div>
    </StorefrontShell>
  );
}
