"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { AdminShellB } from "@/components/admin-b/admin-shell";
import { formatNumber } from "@/lib/admin-format";
import { ProductImage } from "@/components/admin-b/product-image";
import { getDraft, listDrafts, type AdminDraft } from "@/lib/admin-catalog-client";

/**
 * Xem trước bản nháp bằng bố cục Customer, dùng CHÍNH dữ liệu bản nháp từ BE.
 * Không đọc endpoint công khai (bản nháp không được công khai) và không sửa gì.
 */

type DraftProduct = {
  productName?: unknown;
  price?: unknown;
  description?: unknown;
  material?: unknown;
  style?: unknown;
  imageUrl?: unknown;
  categoryName?: unknown;
  brandName?: unknown;
};

function asText(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export default function DraftPreviewPage() {
  return <Suspense fallback={<p role="status">Đang tải Draft…</p>}><DraftPreviewContent /></Suspense>;
}

function DraftPreviewContent() {
  const params = useParams<{ id: string }>();
  const productId = Number(params?.id ?? "");
  const searchParams = useSearchParams();
  // New drafts have their own ID space; only an explicit query selects one.
  const draftParam = searchParams.get("draftId");
  const explicitDraftId = draftParam === null ? null : Number(draftParam);
  const [reload, setReload] = useState(0);
  const invalid = !Number.isSafeInteger(productId) || productId < 1 || (explicitDraftId !== null && (!Number.isSafeInteger(explicitDraftId) || explicitDraftId < 1));
  // The result is tagged with the request it answers, so "loading" is derived when ids or reload change.
  const key = `${productId}:${explicitDraftId}:${reload}`;
  const [result, setResult] = useState<{ key: string; state: "none" | "ready" | "error"; draft: AdminDraft | null; message: string } | null>(null);
  const current = result?.key === key ? result : null;
  const draft = invalid ? null : current?.draft ?? null;
  const state: "loading" | "none" | "ready" | "error" = invalid ? "error" : current?.state ?? "loading";
  const message = invalid ? "Mã sản phẩm chưa hợp lệ." : current?.message ?? "";

  useEffect(() => {
    if (invalid) return;
    const controller = new AbortController();
    (async () => {
      try {
        let full: AdminDraft | null = null;
        if (explicitDraftId !== null) {
          full = await getDraft(explicitDraftId, controller.signal);
        } else {
          // Product links always resolve by productId, never by a coinciding draftId.
          for (let page = 0; !controller.signal.aborted; page++) {
            const drafts = await listDrafts(`page=${page}&size=50`, controller.signal);
            const mine = drafts.find((d) => d.productId === productId);
            if (mine) { full = await getDraft(mine.draftId, controller.signal); break; }
            if (drafts.length < 50) break;
          }
          if (!full) {
            if (!controller.signal.aborted) setResult({ key, state: "none", draft: null, message: "" });
            return;
          }
        }
        if (!controller.signal.aborted) setResult({ key, state: "ready", draft: full, message: "" });
      } catch (failure) {
        if (controller.signal.aborted) return;
        setResult({ key, state: "error", draft: null, message: failure instanceof Error ? failure.message : "Không tải được Draft." });
      }
    })();
    return () => controller.abort();
  }, [invalid, productId, explicitDraftId, key]);

  const product = (draft?.product ?? draft ?? {}) as DraftProduct;
  const backHref = explicitDraftId !== null && !draft?.productId ? `/quan-tri/san-pham/nhap/${explicitDraftId}` : `/quan-tri/san-pham/${draft?.productId ?? productId}`;
  const name = asText(product.productName) ?? "Draft";
  const price = typeof product.price === "number" ? product.price : null;
  const image = asText(product.imageUrl);

  return (
    <AdminShellB active="products" title="Xem trước Draft" eyebrow="Vận hành · Draft sản phẩm">
      <div className="page-heading">
        <div>
          <Link className="back-link" href={backHref}>← Về {explicitDraftId !== null && !draft?.productId ? "Draft" : "chi tiết sản phẩm"}</Link>
          <h1>Xem trước Draft</h1>
          <p className="meta">Xem trước với bố cục dành cho khách hàng; nội dung này chưa công khai.</p>
        </div>
      </div>

      {state === "loading" ? <p className="meta" role="status">Đang tải Draft…</p> : null}
      {state === "none" ? (
        <div className="order-empty">
          <strong>Chưa có Draft</strong>
          <p>Mở trang sửa sản phẩm để tạo Draft, rồi quay lại xem trước.</p>
        </div>
      ) : null}
      {state === "error" ? <div className="catalog-error" role="alert"><p>{message}</p><button type="button" className="secondary" onClick={() => setReload((n) => n + 1)}>Thử lại</button></div> : null}

      {state === "ready" && draft ? (
        <section className="workbench" aria-label={`Xem trước ${name}`}>
          <p className="meta" style={{ marginBottom: 12 }}>
            Draft · phiên bản {draft.version}
          </p>
          <div className="draft-preview-grid">
            <div>{image ? <ProductImage src={image} alt={name} /> : <p className="meta">Draft chưa có ảnh.</p>}</div>
            <div>
              {asText(product.brandName) ? <p className="meta">{asText(product.brandName)}</p> : null}
              <h2 style={{ margin: "4px 0 8px" }}>{name}</h2>
              {price !== null ? (
                <p className="money" style={{ marginBottom: 12 }}>
                  {formatNumber(price)} <span className="unit">VND</span>
                </p>
              ) : null}
              <p className="meta">
                {[asText(product.categoryName), asText(product.material), asText(product.style)].filter(Boolean).join(" · ") || "Chưa có danh mục/chất liệu"}
              </p>
              {asText(product.description) ? <p style={{ marginTop: 12 }}>{asText(product.description)}</p> : null}
              <p className="meta" style={{ marginTop: 16 }}>
                Đây là Draft; khách hàng chỉ thấy nội dung sau khi bạn Publish.
              </p>
            </div>
          </div>
        </section>
      ) : null}
    </AdminShellB>
  );
}
