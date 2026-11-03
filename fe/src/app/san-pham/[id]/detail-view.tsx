"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { BackIcon, ZoomIcon } from "@/components/customer-catalog/catalog-icons";
import {
  CatalogError,
  fetchCatalogProduct,
  formatVnd,
  type CatalogProductDetail,
} from "@/lib/customer-catalog";
import { resolveSelection, isFullySentinel } from "@/lib/variant-select";
import { useCustomerCart } from "@/components/customer-commerce/customer-cart-provider";
import { addCustomerCartItem } from "@/lib/customer-commerce-client";
import { CommerceError } from "@/lib/customer-commerce";
import { readCart, writeCart, type CartItem as GuestItem } from "@/components/storefront/storefront-client";
import "@/components/customer-catalog/catalog.css";

type Viewer = { src: string; alt: string; caption: string; trigger: HTMLButtonElement };

// R5: isPlaceholder + resolveSelection sống trong lib/variant-select để kiểm thử
// biên trực tiếp (tests/variant-select.test.mjs) — component chỉ tiêu thụ.

function swatchColor(color: string): string | null {
  const value = color.toLowerCase();
  if (value.includes("đen")) return "#222";
  if (value.includes("trắng")) return "#fafafa";
  if (value.includes("xám")) return "#8a8a8a";
  if (value.includes("kem")) return "#e8ddc4";
  if (value.includes("xanh")) return "#41627a";
  return null;
}

function ImageDialog({ viewer, onClose }: { viewer: Viewer | null; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (viewer && !dialog.open) {
      setFailed(false);
      dialog.showModal();
    } else if (!viewer && dialog.open) {
      dialog.close();
    }
  }, [viewer]);
  return (
    <dialog ref={ref} className="cat-dialog" aria-labelledby="cat-dialog-title" onClose={onClose}>
      <div className="cat-dialog-head">
        <h2 id="cat-dialog-title">Xem ảnh</h2>
        <button className="cat-dialog-close" type="button" aria-label="Đóng ảnh phóng to" onClick={() => ref.current?.close()}>✕</button>
      </div>
      <div className="cat-dialog-media">
        {viewer ? (
          failed ? (
            <p className="cat-dialog-fail" role="img" aria-label={`Không tải được ảnh: ${viewer.alt}`}>Không tải được ảnh này.</p>
          ) : (
            // eslint-disable-next-line @next/next/no-img-element -- ảnh sản phẩm từ BE/minh họa
            <img src={viewer.src} alt={viewer.alt} referrerPolicy="no-referrer" onError={() => setFailed(true)} />
          )
        ) : null}
      </div>
      <p className="cat-dialog-caption">{viewer?.caption}</p>
    </dialog>
  );
}

export function DetailView({ id }: { id: string }) {
  const [retry, setRetry] = useState(0);
  const viewKey = `${id}|${retry}`;
  const [settled, setSettled] = useState<{ key: string; data?: CatalogProductDetail; error?: string; notFound?: boolean }>({ key: "" });
  const product = settled.key === viewKey ? settled.data ?? null : null;
  const loading = settled.key !== viewKey;
  const notFound = settled.key === viewKey ? settled.notFound ?? false : false;
  const error = settled.key === viewKey ? settled.error ?? "" : "";
  const [color, setColor] = useState("");
  const [size, setSize] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [imageFailed, setImageFailed] = useState(false);
  const [viewer, setViewer] = useState<Viewer | null>(null);
  const [addBusy, setAddBusy] = useState(false);
  const [addNotice, setAddNotice] = useState("");
  const [addError, setAddError] = useState("");
  const { setCart } = useCustomerCart();
  const reqId = useRef(0);

  useEffect(() => {
    const controller = new AbortController();
    const my = ++reqId.current;
    fetchCatalogProduct(id, controller.signal)
      .then((result) => {
        if (reqId.current !== my) return;
        setSettled({ key: viewKey, data: result });
        // R5: không đoán trước lựa chọn — SKU duy nhất tự giải quyết nội bộ,
        // nhiều lựa chọn thì khách phải chọn thật (giống mẫu Nike đã đối chiếu).
        setColor("");
        setSize("");
        setQuantity(1);
        setImageFailed(false);
      })
      .catch((err) => {
        if (controller.signal.aborted || reqId.current !== my) return;
        setSettled({
          key: viewKey,
          notFound: err instanceof CatalogError && err.status === 404,
          error: err instanceof CatalogError && err.status === 404 ? undefined : err instanceof CatalogError ? err.message : "Không kết nối được máy chủ danh mục. Thử lại.",
        });
      });
    return () => controller.abort();
  }, [id, retry, viewKey]);

  const variants = product?.variants ?? [];
  // R5: giải quyết theo số ứng viên duy nhất — không `.find` tùy tiện.
  // Chiều thật duy nhất tự có hiệu lực (không bắt bấm cho có); mập mờ thật
  // (nhiều SKU mà không còn chiều thật nào) ⇒ trạng thái unavailable trung thực.
  // Biến thể duy nhất toàn placeholder (3124) ⇒ một dòng thật, CTA vẫn chạy.
  const singleHonest = variants.length === 1 && variants[0] ? isFullySentinel(variants[0]) : false;
  const selection = resolveSelection(variants, color, size);
  const colors = selection.colors;
  const sizesForColor = selection.sizes;
  const selected = selection.selected;
  const price = product ? product.price + (selected?.additionalPrice ?? 0) : 0;
  const needColor = selection.needColor;
  const needSize = selection.needSize;
  const ambiguous = selection.ambiguous;

  function chooseColor(next: string) {
    setColor(next);
    // Đổi màu ⇒ bỏ cỡ đã chọn (cỡ thuộc về màu cũ có thể không tồn tại).
    setSize("");
  }

  function openZoom(trigger: HTMLButtonElement) {
    if (!product?.imageUrl) return;
    setViewer({
      src: product.imageUrl,
      alt: product.name,
      caption: product.name,
      trigger,
    });
  }

  function closeZoom() {
    const trigger = viewer?.trigger;
    setViewer(null);
    trigger?.focus();
  }

  async function addToCart() {
    if (!selected || addBusy) return;
    setAddBusy(true);
    setAddNotice("");
    setAddError("");
    try {
      const next = await addCustomerCartItem(selected.skuId, quantity);
      setCart(next);
      setAddNotice(`Đã thêm ${quantity} × ${product?.name ?? "sản phẩm"} vào giỏ hàng.`);
    } catch (failure) {
      if (failure instanceof CommerceError && failure.status === 401) {
        const current = readCart() as GuestItem[];
        const meta = [color, size].filter(Boolean).join(" · ");
        const existing = current.find((line) => line.skuId === selected.skuId && line.meta === meta);
        const next = existing
          ? current.map((line) => line === existing ? { ...line, qty: line.qty + quantity } : line)
          : [...current, { id: product?.id ?? Number(id), name: product?.name ?? "Sản phẩm", price, image: product?.imageUrl ?? undefined, qty: quantity, meta, skuId: selected.skuId, color, size }];
        writeCart(next);
        setAddNotice("Đã lưu món này trên thiết bị. Đăng nhập để giữ giỏ hàng của bạn trên mọi thiết bị.");
      } else if (failure instanceof CommerceError && failure.status === 403) {
        setAddError("Tài khoản của bạn có vai trò Quản trị viên/Nhân viên. Chức năng mua hàng trực tuyến chỉ dành cho tài khoản Khách hàng. Vui lòng chuyển sang tài khoản Khách hàng để đặt đơn.");
      } else {
        setAddError(failure instanceof Error ? failure.message : "Không thêm được vào giỏ. Thử lại.");
      }
    } finally {
      setAddBusy(false);
    }
  }

  return (
    <div className="catPage">
      <div className="cat-content cat-detail-content">
        <Link className="cat-text-button cat-back" href="/nam">
          <BackIcon /> Sản phẩm
        </Link>

        {loading ? (
          <p className="cat-status cat-info" role="status">Đang tải sản phẩm…</p>
        ) : notFound ? (
          <div className="cat-empty">
            <h2>Không tìm thấy sản phẩm</h2>
            <p>Sản phẩm có thể đã ngừng hiển thị hoặc mã không hợp lệ.</p>
            <Link className="cat-text-button" href="/nam">Về danh sách sản phẩm</Link>
          </div>
        ) : error ? (
          <div className="cat-status cat-error" role="alert">
            {error}{" "}
            <button className="cat-text-button" type="button" onClick={() => setRetry((n) => n + 1)}>Thử lại</button>
          </div>
        ) : product ? (
          <div className="cat-detail-layout">
            <figure className="cat-detail-figure">
              {product.imageUrl && !imageFailed ? (
                <button
                  className="cat-detail-image-button"
                  type="button"
                  aria-label={`Phóng to ảnh ${product.name}`}
                  onClick={(event) => openZoom(event.currentTarget)}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element -- ảnh sản phẩm từ BE/minh họa */}
                  <img className="cat-detail-image" src={product.imageUrl} alt={product.name} loading="eager" decoding="async" referrerPolicy="no-referrer" onError={() => setImageFailed(true)} />
                  <span className="cat-image-zoom" aria-hidden="true"><ZoomIcon /></span>
                </button>
              ) : (
                <span className="cat-detail-image-fail" role="img" aria-label={`Không tải được ảnh: ${product.name}`}>
                  Không tải được ảnh sản phẩm
                </span>
              )}
              
            </figure>

            <section className="cat-detail-info" aria-label="Thông tin và lựa chọn sản phẩm">
              {product.brandName ? (
                <p className="cat-detail-brand">
                  {/* Logo hãng do BE cung cấp, đã kiểm định; FE chỉ hiển thị ở cỡ
                      nhãn nhỏ (24–28px cao). Không có/không tin cậy ⇒ chỉ chữ. */}
                  {product.brandLogoUrl ? (
                    // Logo thật từ BE nhưng render qua mask một màu: mực trắng/đen của
                    // asset không còn quyết định độ tương phản (Control contact sheet).
                    <span
                      className="cat-detail-brand-mark"
                      aria-hidden="true"
                      style={{ ["--brand-logo" as string]: `url("${product.brandLogoUrl}")` }}
                    />
                  ) : null}
                  <span>{product.brandName}</span>
                </p>
              ) : null}
              <h1>{product.name}</h1>
              <p className="cat-detail-price">{formatVnd(price)}</p>
              {selected && selected.additionalPrice > 0 ? (
                <p className="cat-price-note">Giá tham khảo theo biến thể đã chọn (giá gốc + phụ thu).</p>
              ) : null}

              {colors.length > 1 ? (
                <div className="cat-option-block">
                  <h2>Màu <span>{color || "Chọn"}</span></h2>
                  <div className="cat-option-options">
                    {colors.map((option) => (
                      <button
                        className="cat-option-chip"
                        type="button"
                        key={option}
                        aria-pressed={color === option}
                        onClick={() => chooseColor(option)}
                      >
                        {swatchColor(option) ? <span className="cat-color-swatch" aria-hidden="true" style={{ background: swatchColor(option) ?? undefined }} /> : null}
                        {option}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              {sizesForColor.length > 1 ? (
                <div className="cat-option-block">
                  <h2>Kích cỡ <span>{size || "Chọn"}</span></h2>
                  <div className="cat-option-options">
                    {sizesForColor.map((option) => (
                      <button
                        className="cat-option-chip"
                        type="button"
                        key={option}
                        aria-pressed={size === option}
                        onClick={() => setSize(option)}
                      >
                        {option}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              {!variants.length ? (
                <p className="cat-readonly-note">Máy chủ chưa trả về lựa chọn màu/kích thước cho sản phẩm này.</p>
              ) : null}

              {/* R5: không còn dòng "Cỡ có sẵn" thừa — các pill cỡ đã liệt kê đủ. */}

              <div className="cat-buy-row">
                <div className="cat-stepper" aria-label="Số lượng">
                  <button type="button" aria-label="Giảm số lượng" onClick={() => setQuantity((q) => Math.max(1, q - 1))}>−</button>
                  <span aria-live="polite">{quantity}</span>
                  <button type="button" aria-label="Tăng số lượng" onClick={() => setQuantity((q) => q + 1)}>+</button>
                </div>
                <button className="cat-button cat-primary" type="button" disabled={!selected || addBusy} aria-describedby="cat-buy-note" onClick={addToCart}>
                  {addBusy ? "Đang thêm…" : "Thêm vào giỏ"}
                </button>
              </div>
              {needColor || needSize ? (
                <p className="cat-readonly-note" role="status" id="cat-buy-note">
                  {needColor ? "Chọn màu" : "Chọn kích cỡ"} để thêm vào giỏ.
                </p>
              ) : null}
              {singleHonest ? (
                <p className="cat-readonly-note" role="status">Một phiên bản duy nhất — thêm trực tiếp vào giỏ.</p>
              ) : null}
              {ambiguous ? (
                <p className="cat-readonly-note" role="status">
                  Máy chủ trả về {variants.length} mã hàng nhưng thiếu thông tin màu/cỡ để phân biệt —
                  liên hệ cửa hàng để đặt, không tự đoán mã.
                </p>
              ) : null}
              {!selected && !needColor && !needSize && !ambiguous && !singleHonest && variants.length > 0 ? (
                <p className="cat-readonly-note" role="status">Các mã hàng còn lại trùng thông tin hiển thị — liên hệ cửa hàng để đặt đúng mã.</p>
              ) : null}
              {addNotice ? <p className="cat-readonly-note" role="status">{addNotice}{addNotice.includes("Đăng nhập") ? <> <Link className="cat-text-button" href="/dang-nhap?next=%2Fgio-hang">Đăng nhập →</Link></> : null}</p> : null}
              {addError ? <p className="cat-error" role="alert">{addError}</p> : null}

              <div className="cat-disclosures">
                <details>
                  <summary>Thông tin sản phẩm</summary>
                  <dl className="cat-attr-list">
                    {product.categoryName ? (<div><dt>Danh mục</dt><dd>{product.categoryName}</dd></div>) : null}
                    {product.material ? (<div><dt>Chất liệu</dt><dd>{product.material}</dd></div>) : null}
                    {product.style ? (<div><dt>Kiểu dáng</dt><dd>{product.style}</dd></div>) : null}
                    {product.brandName ? (<div><dt>Thương hiệu</dt><dd>{product.brandName}</dd></div>) : null}
                    {!product.categoryName && !product.material && !product.style && !product.brandName ? (
                      <div><dt>Thông tin</dt><dd>Chưa có thông tin bổ sung.</dd></div>
                    ) : null}
                  </dl>
                  {product.sourceHost ? (
                    <p className="cat-source-inline">
                      Nguồn: {product.sourceUrl ? (<a href={product.sourceUrl} target="_blank" rel="noopener noreferrer">{product.sourceHost}</a>) : product.sourceHost}
                      {" · "}giá demo
                    </p>
                  ) : null}
                </details>
                <details>
                  <summary>Giao hàng &amp; đổi trả</summary>
                  <div className="cat-tech-body">Liên hệ cửa hàng để biết chính sách giao hàng và đổi trả hiện hành.</div>
                </details>
              </div>
            </section>
          </div>
        ) : null}
        <ImageDialog viewer={viewer} onClose={closeZoom} />
      </div>
    </div>
  );
}
