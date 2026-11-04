"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { AdminShellB } from "@/components/admin-b/admin-shell";
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
  return <Suspense fallback={<p role="status">Đang tải bản nháp…</p>}><DraftPreviewContent /></Suspense>;
}

function DraftPreviewContent() {
  const params = useParams<{ id: string }>();
  const productId = Number(params?.id ?? "");
  const searchParams = useSearchParams();
  // New drafts have their own ID space; only an explicit query selects one.
  const draftParam = searchParams.get("draftId");
  const explicitDraftId = draftParam === null ? null : Number(draftParam);
  const [draft, setDraft] = useState<AdminDraft | null>(null);
  const [state, setState] = useState<"loading" | "none" | "ready" | "error">("loading");
  const [message, setMessage] = useState("");
  const [reload, setReload] = useState(0);

  useEffect(() => {
    if (!Number.isSafeInteger(productId) || productId < 1 || (explicitDraftId !== null && (!Number.isSafeInteger(explicitDraftId) || explicitDraftId < 1))) {
      setState("error");
      setMessage("Mã sản phẩm chưa hợp lệ.");
      return;
    }
    const controller = new AbortController();
    (async () => {
      try {
        setState("loading");
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
            if (!controller.signal.aborted) setState("none");
            return;
          }
        }
        if (!controller.signal.aborted) {
          setDraft(full);
          setState("ready");
        }
      } catch (failure) {
        if (controller.signal.aborted) return;
        setState("error");
        setMessage(failure instanceof Error ? failure.message : "Không tải được bản nháp.");
      }
    })();
    return () => controller.abort();
  }, [productId, explicitDraftId, reload]);

  const product = (draft?.product ?? draft ?? {}) as DraftProduct;
  const backHref = explicitDraftId !== null && !draft?.productId ? `/quan-tri/san-pham/nhap/${explicitDraftId}` : `/quan-tri/san-pham/${draft?.productId ?? productId}`;
  const name = asText(product.productName) ?? "Bản nháp";
  const price = typeof product.price === "number" ? product.price : null;
  const image = asText(product.imageUrl);

  return (
    <AdminShellB active="products" title="Xem trước bản nháp" eyebrow="Vận hành · dữ liệu bản nháp thật">
      <div className="page-heading">
        <div>
          <h1>Xem trước bản nháp</h1>
          <p className="meta">Bố cục Customer · dữ liệu bản nháp từ BE · khách hàng không truy cập được nội dung này.</p>
        </div>
        <Link className="text-link" href={backHref}>← Về {explicitDraftId !== null && !draft?.productId ? "bản nháp" : "chi tiết sản phẩm"}</Link>
      </div>

      {state === "loading" ? <p className="meta" role="status">Đang tải bản nháp…</p> : null}
      {state === "none" ? (
        <div className="order-empty">
          <strong>Chưa có bản nháp</strong>
          <p>Sửa metadata ở trang chi tiết để mở bản nháp, rồi quay lại xem trước.</p>
        </div>
      ) : null}
      {state === "error" ? <div className="catalog-error" role="alert"><p>{message}</p><button type="button" className="text-link" onClick={() => setReload((n) => n + 1)}>Thử lại</button></div> : null}

      {state === "ready" && draft ? (
        <section className="workbench" aria-label={`Xem trước ${name}`}>
          <p className="meta" style={{ marginBottom: 12 }}>
            Bản nháp #{draft.draftId} · phiên bản {draft.version} · trạng thái {String(draft.draftState ?? draft.status)}
          </p>
          <div className="draft-preview-grid">
            <div>{image ? <ProductImage src={image} alt={name} /> : <p className="meta">Bản nháp chưa có ảnh.</p>}</div>
            <div>
              {asText(product.brandName) ? <p className="meta">{asText(product.brandName)}</p> : null}
              <h2 style={{ margin: "4px 0 8px" }}>{name}</h2>
              {price !== null ? (
                <p className="money" style={{ marginBottom: 12 }}>
                  {price.toLocaleString("vi-VN")} <span className="unit">VND</span>
                </p>
              ) : null}
              <p className="meta">
                {[asText(product.categoryName), asText(product.material), asText(product.style)].filter(Boolean).join(" · ") || "Chưa có danh mục/chất liệu"}
              </p>
              {asText(product.description) ? <p style={{ marginTop: 12 }}>{asText(product.description)}</p> : null}
              <p className="meta" style={{ marginTop: 16 }}>
                Đây là bản nháp. Khách hàng chỉ thấy nội dung sau khi bạn bấm Xuất bản.
              </p>
            </div>
          </div>
        </section>
      ) : null}
    </AdminShellB>
  );
}
