"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
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
  const params = useParams<{ id: string }>();
  const productId = Number(params?.id ?? "");
  const [draft, setDraft] = useState<AdminDraft | null>(null);
  const [state, setState] = useState<"loading" | "none" | "ready" | "error">("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!Number.isSafeInteger(productId) || productId < 1) {
      setState("error");
      setMessage("Mã sản phẩm chưa hợp lệ.");
      return;
    }
    const controller = new AbortController();
    (async () => {
      try {
        // `id` có thể là productId (bản nháp sửa) hoặc draftId (bản nháp mới):
        // thử đọc trực tiếp như draftId trước, rồi mới tra theo productId.
        let full: AdminDraft | null = null;
        try {
          full = await getDraft(productId, controller.signal);
        } catch {
          full = null;
        }
        if (!full) {
          const drafts = await listDrafts("page=0&size=50", controller.signal);
          const mine = drafts.find((d) => d.productId === productId);
          if (!mine) {
            if (!controller.signal.aborted) setState("none");
            return;
          }
          full = await getDraft(mine.draftId, controller.signal);
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
  }, [productId]);

  const product = (draft?.product ?? {}) as DraftProduct;
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
        <Link className="text-link" href={`/quan-tri/san-pham/${productId}`}>← Về chi tiết sản phẩm</Link>
      </div>

      {state === "loading" ? <p className="meta" role="status">Đang tải bản nháp…</p> : null}
      {state === "none" ? (
        <div className="order-empty">
          <strong>Chưa có bản nháp</strong>
          <p>Sửa metadata ở trang chi tiết để mở bản nháp, rồi quay lại xem trước.</p>
        </div>
      ) : null}
      {state === "error" ? <p className="catalog-error" role="alert">{message}</p> : null}

      {state === "ready" && draft ? (
        <section className="workbench" aria-label={`Xem trước ${name}`}>
          <p className="meta" style={{ marginBottom: 12 }}>
            Bản nháp #{draft.draftId} · phiên bản {draft.version} · trạng thái {draft.status}
          </p>
          <div style={{ display: "grid", gap: 24, gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)", alignItems: "start" }}>
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
