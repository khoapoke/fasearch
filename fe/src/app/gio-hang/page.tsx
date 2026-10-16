"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { StorefrontShell } from "@/components/storefront/storefront-shell";
import { readOwnIdentity } from "@/components/account/account-session";
import { readCart, writeCart, type CartItem as GuestItem } from "@/components/storefront/storefront-client";
import { StitchImage } from "@/components/ui/stitch-image";
import { formatVnd } from "@/components/storefront/product-card";
import {
  deleteCartItem, fetchCart, fetchWarehouses, putCartItem, quoteCart,
} from "@/lib/commerce-client";
import {
  commerceErrorMessage, formatVndContract,
  type Cart, type Quote, type Warehouse,
} from "@/lib/commerce";
import "@/components/storefront/preview.css";

type LoadState =
  | { kind: "checking" }
  | { kind: "guest"; items: GuestItem[] }
  | { kind: "loading" }
  | { kind: "ready"; cart: Cart; quote: Quote | null; warehouses: Warehouse[]; maKho: number | null }
  | { kind: "error"; message: string; status: number };

const GUEST_IMPORTED_KEY = "fasearch-cart-imported-v1";

function readImportedSkus(): Set<string> {
  try {
    const raw = localStorage.getItem(GUEST_IMPORTED_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(arr) ? arr.map(String) : []);
  } catch {
    return new Set();
  }
}

function markImported(skus: Array<string | number>) {
  try {
    const set = readImportedSkus();
    for (const s of skus) set.add(String(s));
    localStorage.setItem(GUEST_IMPORTED_KEY, JSON.stringify([...set]));
  } catch {
    /* ignore */
  }
}

export default function CartPage() {
  const [state, setState] = useState<LoadState>({ kind: "checking" });
  const [authed, setAuthed] = useState(false);
  const [busySku, setBusySku] = useState<number | null>(null);
  const [notice, setNotice] = useState("");
  const [quoteBusy, setQuoteBusy] = useState(false);
  const pendingRef = useRef(false);
  const errorRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    setNotice("");
    let me = null;
    try {
      me = await readOwnIdentity();
    } catch {
      me = null;
    }
    if (!me) {
      setAuthed(false);
      setState({ kind: "guest", items: readCart() });
      return;
    }
    setAuthed(true);
    setState({ kind: "loading" });
    try {
      const cart = await fetchCart();
      let warehouses: Warehouse[] = [];
      try {
        warehouses = await fetchWarehouses();
      } catch {
        warehouses = [];
      }
      const def = warehouses.find((w) => w.laMacDinh) ?? warehouses[0] ?? null;
      // Guest import một lần: chỉ entries có maSku (gắn bởi detail mới), bỏ qua legacy product-only.
      const guest = readCart() as Array<GuestItem & { maSku?: number }>;
      const imported = readImportedSkus();
      const candidates = guest.filter((g) => typeof g.maSku === "number" && !imported.has(String(g.maSku)));
      if (candidates.length > 0 && cart) {
        const done: string[] = [];
        for (const c of candidates.slice(0, 100)) {
          try {
            const qty = Math.min(999, Math.max(1, c.qty || 1));
            // Lấy version mới nhất trước mỗi PUT để tránh 409 dây chuyền.
            const fresh = await fetchCart();
            await putCartItem(c.maSku as number, qty, fresh.phienBan);
            done.push(String(c.maSku));
          } catch {
            // Import thất bại từng dòng → giữ lại guest, báo trung thực ở notice.
          }
        }
        if (done.length > 0) {
          markImported(done);
          const remaining = guest.filter((g) => !(typeof g.maSku === "number" && done.includes(String(g.maSku))));
          writeCart(remaining);
          setNotice(`Đã nhập ${done.length} món từ giỏ khách vào giỏ tài khoản. Món không rõ SKU được giữ lại minh bạch bên dưới.`);
        }
      }
      const finalCart = candidates.length > 0 ? await fetchCart().catch(() => cart) : cart;
      setState({ kind: "ready", cart: finalCart, quote: null, warehouses, maKho: def ? def.maKho : null });
    } catch (e) {
      const status = (e as { status?: number })?.status ?? 0;
      const msg = e instanceof Error ? e.message : "Không tải được giỏ hàng.";
      if (status === 401) {
        setAuthed(false);
        setState({ kind: "guest", items: readCart() });
        return;
      }
      setState({ kind: "error", message: commerceErrorMessage(status, msg), status });
      setTimeout(() => errorRef.current?.focus(), 0);
    }
  }, []);

  useEffect(() => {
    void Promise.resolve().then(() => load());
  }, [load]);

  async function changeQty(maSku: number, qty: number, phienBan: number) {
    if (pendingRef.current) return;
    if (qty < 1) {
      await removeItem(maSku, phienBan);
      return;
    }
    if (qty > 999) {
      setNotice("Số lượng tối đa 999.");
      return;
    }
    pendingRef.current = true;
    setBusySku(maSku);
    setNotice("");
    try {
      const next = await putCartItem(maSku, qty, phienBan);
      setState((s) => (s.kind === "ready" ? { ...s, cart: next, quote: null } : s));
    } catch (e) {
      const status = (e as { status?: number })?.status ?? 0;
      const msg = e instanceof Error ? e.message : "Cập nhật thất bại.";
      setNotice(commerceErrorMessage(status, msg) + (status === 409 ? " Giỏ đã làm mới — kiểm tra số lượng rồi thử lại." : " Số lượng đã nhập được giữ nguyên."));
      if (status === 409) {
        try {
          const fresh = await fetchCart();
          setState((s) => (s.kind === "ready" ? { ...s, cart: fresh, quote: null } : s));
        } catch {
          /* keep */
        }
      }
    } finally {
      pendingRef.current = false;
      setBusySku(null);
    }
  }

  async function removeItem(maSku: number, phienBan: number) {
    if (pendingRef.current) return;
    pendingRef.current = true;
    setBusySku(maSku);
    try {
      const next = await deleteCartItem(maSku, phienBan);
      setState((s) => (s.kind === "ready" ? { ...s, cart: next, quote: null } : s));
    } catch (e) {
      const status = (e as { status?: number })?.status ?? 0;
      const msg = e instanceof Error ? e.message : "Xóa thất bại.";
      setNotice(commerceErrorMessage(status, msg));
      if (status === 409) {
        try {
          const fresh = await fetchCart();
          setState((s) => (s.kind === "ready" ? { ...s, cart: fresh, quote: null } : s));
        } catch {
          /* keep */
        }
      }
    } finally {
      pendingRef.current = false;
      setBusySku(null);
    }
  }

  async function runQuote() {
    if (state.kind !== "ready" || state.maKho === null) {
      setNotice("Chọn kho phục vụ trước khi lấy báo giá.");
      return;
    }
    setQuoteBusy(true);
    setNotice("");
    try {
      const q = await quoteCart(state.maKho, state.cart.phienBan);
      setState({ ...state, quote: q });
    } catch (e) {
      const status = (e as { status?: number })?.status ?? 0;
      const msg = e instanceof Error ? e.message : "Lấy báo giá thất bại.";
      setNotice(commerceErrorMessage(status, msg));
      if (status === 409) {
        try {
          const fresh = await fetchCart();
          setState((s) => (s.kind === "ready" ? { ...s, cart: fresh, quote: null } : s));
        } catch {
          /* keep */
        }
      }
    } finally {
      setQuoteBusy(false);
    }
  }

  const guestUnresolved = (() => {
    if (!authed) return [];
    try {
      return (readCart() as Array<GuestItem & { maSku?: number }>).filter((g) => typeof g.maSku !== "number");
    } catch {
      return [];
    }
  })();

  return (
    <StorefrontShell
      active="/gio-hang"
      previewNote="Giỏ hàng thật: máy chủ giữ giỏ và tổng tiền; khách chưa đăng nhập dùng giỏ trình duyệt và được mời đăng nhập để đồng bộ."
    >
      <div className="pvWrap">
        <nav className="pgCrumbs" aria-label="Đường dẫn">
          <Link href="/">Trang chủ</Link><span aria-hidden="true">›</span>
          <span aria-current="page">Giỏ hàng</span>
        </nav>
        <h1 className="pgTitle">Giỏ Hàng Của Bạn</h1>

        {notice ? <p className="mpMuted" role="status" style={{ marginBottom: 10 }}>{notice}</p> : null}

        {state.kind === "checking" || state.kind === "loading" ? (
          <p className="pgState" role="status"><strong>Đang tải giỏ hàng từ máy chủ…</strong></p>
        ) : null}

        {state.kind === "error" ? (
          <div ref={errorRef} tabIndex={-1} className="pvCard" role="alert" aria-label="Lỗi giỏ hàng">
            <h2>Không tải được giỏ hàng</h2>
            <p className="sub">{state.message} Lựa chọn và bộ lọc được giữ nguyên.</p>
            <p style={{ display: "flex", gap: 8 }}>
              <button className="hmCta hmCtaPrimary" type="button" onClick={load}>Thử lại</button>
              {state.status === 401 || state.status === 403 ? (
                <Link className="hmCta hmCtaGhost" href="/dang-nhap?next=/gio-hang">Đăng nhập →</Link>
              ) : null}
            </p>
          </div>
        ) : null}

        {state.kind === "guest" ? (
          <div className="pvGrid">
            <section className="pvCard" aria-label="Giỏ khách">
              <h2>Giỏ trên trình duyệt này ({state.items.reduce((n, i) => n + i.qty, 0)} món)</h2>
              <p className="sub">Đăng nhập để đồng bộ giỏ thật với máy chủ. Món chỉ có mã sản phẩm (không rõ SKU biến thể) sẽ không tự đoán — hiển thị minh bạch.</p>
              {state.items.length === 0 ? (
                <p className="pgState"><strong>Giỏ đang trống</strong>Hãy thêm sản phẩm từ <Link href="/nam">Nam</Link> hoặc <Link href="/nu">Nữ</Link>.</p>
              ) : (
                state.items.map((i) => (
                  <div className="pvRow" key={`${i.id}-${i.meta ?? ""}`}>
                    <StitchImage src={i.image} alt="" className="pvThumb" />
                    <div style={{ flex: 1 }}>
                      <b className="name"><Link href={`/san-pham/${i.id}`}>{i.name}</Link></b>
                      {i.meta ? <small>{i.meta}</small> : null}
                      {(i as GuestItem & { maSku?: number }).maSku ? (
                        <small>SKU {(i as GuestItem & { maSku?: number }).maSku} · sẽ nhập 1 lần sau đăng nhập</small>
                      ) : (
                        <small>Chưa rõ SKU biến thể — đăng nhập rồi chọn lại màu/size để đồng bộ chính xác.</small>
                      )}
                    </div>
                    <b className="pPrice">{formatVnd(i.price * i.qty)}</b>
                  </div>
                ))
              )}
              <p style={{ marginTop: 12 }}>
                <Link className="hmCta hmCtaPrimary" href="/dang-nhap?next=/gio-hang">Đăng nhập để dùng giỏ thật →</Link>
              </p>
            </section>
            <aside>
              <section className="pvCard" aria-label="Ghi chú">
                <h2>Tổng tiền do máy chủ quyết định</h2>
                <p className="sub">Giỏ khách chỉ là bản nháp trình duyệt. Giá/kho/phí pilot hiển thị sau khi đăng nhập và lấy báo giá máy chủ. Giảm giá đợt này là 0.</p>
              </section>
            </aside>
          </div>
        ) : null}

        {state.kind === "ready" ? (
          <div className="pvGrid">
            <div>
              <section className="pvCard" aria-label="Sản phẩm trong giỏ">
                {state.cart.items.length === 0 ? (
                  <p className="pgState"><strong>Giỏ hàng đang trống</strong>Hãy thêm SKU từ <Link href="/nam">Nam</Link> hoặc <Link href="/nu">Nữ</Link>.</p>
                ) : (
                  state.cart.items.map((i) => (
                    <div className="pvRow" key={i.maSku}>
                      <div style={{ flex: 1 }}>
                        <b className="name">{i.tenSp} <small>· SKU {i.maSku} · SP {i.maSp}</small></b>
                        <small>{[i.mauSac, i.kichCo].filter(Boolean).join(" · ") || "—"} · Đơn giá {formatVndContract(i.donGia)}</small>
                        {!i.coTheMua ? (
                          <p role="note" style={{ color: "#b42318", fontSize: 12.5, marginTop: 4 }}>
                            Tạm không thể mua: {i.lyDoKhongTheMua ?? "hết hàng/không khả dụng"}.
                          </p>
                        ) : null}
                        <div>
                          <span className="pvQty">
                            <button type="button" aria-label={`Giảm SKU ${i.maSku}`} disabled={busySku === i.maSku} onClick={() => changeQty(i.maSku, i.soLuong - 1, state.cart.phienBan)}>−</button>
                            <b aria-live="polite">{i.soLuong}</b>
                            <button type="button" aria-label={`Tăng SKU ${i.maSku}`} disabled={busySku === i.maSku} onClick={() => changeQty(i.maSku, i.soLuong + 1, state.cart.phienBan)}>+</button>
                          </span>
                          <button
                            type="button"
                            disabled={busySku === i.maSku}
                            onClick={() => removeItem(i.maSku, state.cart.phienBan)}
                            style={{ border: 0, background: "none", cursor: "pointer", color: "var(--ink-soft)", fontSize: 12.5, marginLeft: 10 }}
                          >
                            Xóa
                          </button>
                        </div>
                      </div>
                      <b className="pPrice">{formatVndContract(i.tongDong)}</b>
                    </div>
                  ))
                )}
                <p className="mpMuted" style={{ fontSize: 12.5, marginTop: 8 }}>
                  Phiên bản giỏ: {state.cart.phienBan} · Tổng hàng (máy chủ): {formatVndContract(state.cart.tongTienHang)}
                </p>
              </section>
              {guestUnresolved.length > 0 ? (
                <section className="pvCard" aria-label="Món khách chưa rõ SKU">
                  <h2>Món trình duyệt chưa rõ SKU ({guestUnresolved.length})</h2>
                  <p className="sub">Không tự đoán biến thể. Mở sản phẩm và chọn đúng màu/size để thêm SKU thật.</p>
                  {guestUnresolved.map((g) => (
                    <div className="pvRow" key={`${g.id}-${g.meta ?? ""}`}>
                      <div style={{ flex: 1 }}>
                        <b className="name"><Link href={`/san-pham/${g.id}`}>{g.name}</Link></b>
                        <small>{g.meta ?? "chưa rõ biến thể"}</small>
                      </div>
                      <b>{formatVnd(g.price * g.qty)}</b>
                    </div>
                  ))}
                </section>
              ) : null}
            </div>
            <aside>
              <section className="pvCard" aria-label="Kho và báo giá">
                <h2>Kho phục vụ &amp; báo giá máy chủ</h2>
                {state.warehouses.length === 0 ? (
                  <p className="sub" role="note">Chưa tải được danh sách kho — <button type="button" className="mpTopBtn" onClick={load}>Tải lại</button></p>
                ) : (
                  <div className="pvField">
                    <label htmlFor="cart-warehouse">Kho (1 kho/kê đơn)</label>
                    <select
                      id="cart-warehouse"
                      value={state.maKho ?? ""}
                      onChange={(e) => setState({ ...state, maKho: Number(e.target.value), quote: null })}
                    >
                      <option value="">— Chọn kho —</option>
                      {state.warehouses.map((w) => (
                        <option key={w.maKho} value={w.maKho}>{w.tenKho}{w.laMacDinh ? " (mặc định)" : ""}</option>
                      ))}
                    </select>
                  </div>
                )}
                <button className="hmCta hmCtaGhost" style={{ width: "100%", justifyContent: "center" }} type="button" disabled={quoteBusy || state.maKho === null} onClick={runQuote}>
                  {quoteBusy ? "Đang lấy báo giá…" : "Lấy báo giá máy chủ"}
                </button>
                {state.quote ? (
                  <div style={{ marginTop: 10 }}>
                    <div className="pvLine"><span>Tạm tính</span><span>{formatVndContract(state.quote.tongTienHang)}</span></div>
                    <div className="pvLine"><span>Giảm giá</span><span>{formatVndContract(state.quote.giamGia)} (đợt này 0)</span></div>
                    <div className="pvLine"><span>Phí vận chuyển pilot</span><span>{formatVndContract(state.quote.phiVanChuyen)}</span></div>
                    <div className="pvLine total"><span>Tổng thanh toán</span><span>{formatVndContract(state.quote.tongThanhToan)}</span></div>
                    {!state.quote.coTheDat ? <p role="note" style={{ color: "#b42318", fontSize: 12.5 }}>Giỏ hiện chưa thể đặt — xem cảnh báo.</p> : null}
                    {state.quote.canhBao.length > 0 ? (
                      <ul style={{ fontSize: 12.5, marginTop: 6 }}>
                        {state.quote.canhBao.map((c, k) => <li key={k}>{c}</li>)}
                      </ul>
                    ) : null}
                  </div>
                ) : (
                  <p className="mpMuted" style={{ fontSize: 12.5, marginTop: 8 }}>Tổng thanh toán chỉ có sau báo giá máy chủ. Không dùng tổng trình duyệt.</p>
                )}
                <Link
                  className="hmCta hmCtaPrimary"
                  style={{ width: "100%", justifyContent: "center", marginTop: 12, opacity: state.cart.items.length ? 1 : 0.5 }}
                  href="/thanh-toan"
                  aria-disabled={state.cart.items.length === 0}
                >
                  Tiến hành thanh toán →
                </Link>
              </section>
            </aside>
          </div>
        ) : null}
      </div>
    </StorefrontShell>
  );
}
