"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { BackIcon, ZoomIcon } from "@/components/customer-catalog/catalog-icons";
import {
  CatalogError,
  fetchCatalogProduct,
  formatVnd,
  type CatalogProductDetail,
  type CatalogVariant,
} from "@/lib/customer-catalog";
import "@/components/customer-catalog/catalog.css";

type Viewer = { src: string; alt: string; caption: string; trigger: HTMLButtonElement };

function unique(values: Array<string | null>): string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value)))];
}

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
  const reqId = useRef(0);

  useEffect(() => {
    const controller = new AbortController();
    const my = ++reqId.current;
    fetchCatalogProduct(id, controller.signal)
      .then((result) => {
        if (reqId.current !== my) return;
        setSettled({ key: viewKey, data: result });
        setColor(result.variants[0]?.color ?? "");
        setSize(result.variants[0]?.size ?? "");
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
  const colors = unique(variants.map((v) => v.color));
  const sizesForColor = unique(variants.filter((v) => !color || v.color === color).map((v) => v.size));
  const selected: CatalogVariant | undefined =
    variants.find((v) => (!color || v.color === color) && (!size || v.size === size)) ?? variants[0];
  const price = product ? product.price + (selected?.additionalPrice ?? 0) : 0;

  function chooseColor(next: string) {
    setColor(next);
    const first = variants.find((v) => v.color === next);
    setSize(first?.size ?? "");
  }

  function openZoom(trigger: HTMLButtonElement) {
    if (!product?.imageUrl) return;
    setViewer({
      src: product.imageUrl,
      alt: product.name,
      caption: `${product.name} · Ảnh do máy chủ danh mục trả về.`,
      trigger,
    });
  }

  function closeZoom() {
    const trigger = viewer?.trigger;
    setViewer(null);
    trigger?.focus();
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
              <figcaption>Ảnh sản phẩm do máy chủ danh mục trả về.</figcaption>
            </figure>

            <section className="cat-detail-info" aria-label="Thông tin và lựa chọn sản phẩm">
              <h1>{product.name}</h1>
              {product.description ? <p className="cat-product-description">{product.description}</p> : null}
              <p className="cat-detail-price">{formatVnd(price)}</p>
              {selected && selected.additionalPrice > 0 ? (
                <p className="cat-price-note">Giá tham khảo theo biến thể đã chọn (giá gốc + phụ thu).</p>
              ) : null}

              {colors.length ? (
                <div className="cat-option-block">
                  <h2>Màu <span>{color || "—"}</span></h2>
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

              {sizesForColor.length ? (
                <div className="cat-option-block">
                  <h2>Kích cỡ <span>{size || "—"}</span></h2>
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

              <details className="cat-size-guide">
                <summary>Bảng cỡ (tham khảo)</summary>
                <div className="cat-size-guide-body">
                  <p>Chưa có số đo thật của từng cỡ trong dữ liệu công khai của pilot.</p>
                </div>
              </details>

              <div className="cat-buy-row">
                <div className="cat-stepper" aria-label="Số lượng">
                  <button type="button" aria-label="Giảm số lượng" onClick={() => setQuantity((q) => Math.max(1, q - 1))}>−</button>
                  <span aria-live="polite">{quantity}</span>
                  <button type="button" aria-label="Tăng số lượng" onClick={() => setQuantity((q) => q + 1)}>+</button>
                </div>
                <button className="cat-button cat-primary" type="button" disabled aria-describedby="cat-buy-note">
                  Thêm vào giỏ
                </button>
              </div>
              <p className="cat-readonly-note" id="cat-buy-note">
                Bản xem thử chỉ đọc: chưa kết nối giỏ hàng máy chủ. Tồn kho chưa có trong API công khai.
              </p>

              <div className="cat-disclosures">
                <details>
                  <summary>Sản phẩm</summary>
                  <div className="cat-tech-body">
                    {[product.categoryName ? `Danh mục: ${product.categoryName}` : null, product.material ? `Chất liệu: ${product.material}` : null, product.style ? `Kiểu dáng: ${product.style}` : null]
                      .filter(Boolean)
                      .join(" · ") || "Chưa có thông tin bổ sung từ máy chủ."}
                  </div>
                </details>
                <details>
                  <summary>Giao hàng &amp; đổi trả</summary>
                  <div className="cat-tech-body">Chưa có chính sách giao hàng/đổi trả trong dữ liệu công khai của pilot này.</div>
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
