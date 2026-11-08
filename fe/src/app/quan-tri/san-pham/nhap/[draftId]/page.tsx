"use client";

import { ImageDrop } from "@/components/admin-b/image-drop";
import { InfoHint } from "@/components/admin-b/info-hint";
import { useToast } from "@/components/admin-b/toast";
import { CardSkeleton } from "@/components/admin-b/skeleton";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { AdminShellB } from "@/components/admin-b/admin-shell";
import { formatNumber } from "@/lib/admin-format";
import {
  getDraft,
  publishDraft,
  updateDraft,
  uploadDraftImage,
  resolveDraftImageUrl,
  CatalogAdminError,
  type AdminDraft,
} from "@/lib/admin-catalog-client";
import { buildSkuCombinations } from "@/lib/sku-combinations";

/**
 * Bản nháp sản phẩm mới (chưa có productId cho tới khi xuất bản).
 *
 * Dùng đúng hợp đồng BE v1: ảnh tải lên làm tăng draft.version nên phải đọc lại
 * bản nháp trước khi lưu/xuất bản; biến thể khai báo qua `variants` của bản nháp
 * (không gọi endpoint SKU legacy vì bản nháp chưa phải sản phẩm).
 */

type DraftVariant = { color: string | null; size: string | null };

function variantsOf(draft: AdminDraft): DraftVariant[] {
  const raw = (draft.variants ?? []) as Array<Record<string, unknown>>;
  return raw.map((v) => ({
    color: typeof v.color === "string" ? v.color : null,
    size: typeof v.size === "string" ? v.size : null,
  }));
}

export default function NewDraftPage() {
  const params = useParams<{ draftId: string }>();
  // Keyed by id: moving between drafts remounts and starts from the loading state.
  return <NewDraftContent key={params?.draftId ?? ""} />;
}

function NewDraftContent() {
  const params = useParams<{ draftId: string }>();
  const draftId = Number(params?.draftId ?? "");
  const invalidId = !Number.isSafeInteger(draftId) || draftId < 1;
  const router = useRouter();
  const toast = useToast();
  const [draft, setDraft] = useState<AdminDraft | null>(null);
  const [loadState, setState] = useState<"loading" | "ready" | "error">("loading");
  const [loadMessage, setMessage] = useState("");
  const state = invalidId ? "error" : loadState;
  const message = invalidId && loadMessage === "" ? "Mã Draft chưa hợp lệ." : loadMessage;
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [colors, setColors] = useState("");
  const [sizes, setSizes] = useState("");
  const [skus, setSkus] = useState<DraftVariant[]>([]);

  const apply = useCallback((result: { fresh: AdminDraft } | { failure: unknown }) => {
    if ("fresh" in result) {
      setDraft(result.fresh);
      setSkus(variantsOf(result.fresh));
      setState("ready");
    } else {
      setState("error");
      setMessage(result.failure instanceof Error ? result.failure.message : "Không tải được Draft.");
    }
  }, []);

  // Event handlers (after a conflict or publish) show the loading state, then refetch.
  const load = useCallback(async () => {
    if (invalidId) return;
    setState("loading");
    apply(await getDraft(draftId).then((fresh) => ({ fresh }), (failure: unknown) => ({ failure })));
  }, [apply, draftId, invalidId]);

  // The first load is an effect; state is applied from the promise callback.
  useEffect(() => {
    if (invalidId) return;
    let live = true;
    void getDraft(draftId).then((fresh) => ({ fresh }), (failure: unknown) => ({ failure })).then((result) => {
      if (live) apply(result);
    });
    return () => { live = false; };
  }, [apply, draftId, invalidId]);

  async function upload(file: File) {
    if (!draft || busy) return;
    setBusy(true); setMessage(""); setNotice("");
    try {
      const result = await uploadDraftImage(draft.draftId, file);
      if (result?.imageUrl) {
        // Tải ảnh làm tăng version: đọc lại để không tự 409 khi lưu/xuất bản.
        const fresh = await getDraft(draft.draftId);
        setDraft(fresh);
        setNotice("Đã tải ảnh vào Draft (phiên bản mới). Bấm Publish để đưa lên catalog."); toast.success("Đã tải ảnh vào Draft (phiên bản mới). Bấm Publish để đưa lên catalog.");
      } else {
        setNotice("Máy chủ đã nhận ảnh nhưng không trả URL; kiểm tra lại Draft.");
      }
    } catch (failure) {
      setMessage(failure instanceof Error ? failure.message : "Không tải được ảnh.");
    } finally {
      setBusy(false);
    }
  }

  function planSkus() {
    if (!draft) return;
    const colorList = colors.split(",").map((v) => v.trim()).filter(Boolean);
    const sizeList = sizes.split(",").map((v) => v.trim()).filter(Boolean);
    if (!colorList.length || !sizeList.length) {
      setMessage("Nhập ít nhất một màu và một cỡ, cách nhau bằng dấu phẩy.");
      return;
    }
    const { combinations, skippedDuplicate } = buildSkuCombinations(colorList, sizeList, skus);
    setMessage("");
    if (!combinations.length) {
      setMessage(skippedDuplicate > 0 ? `Tất cả ${skippedDuplicate} tổ hợp đã có.` : "Không có tổ hợp hợp lệ.");
      return;
    }
    setSkus([...skus, ...combinations]);
    setNotice(`Đã thêm ${combinations.length} tổ hợp vào danh sách chờ lưu${skippedDuplicate ? ` (bỏ qua ${skippedDuplicate} trùng)` : ""}.`);
  }

  async function saveVariants() {
    if (!draft || busy) return;
    setBusy(true); setMessage(""); setNotice("");
    try {
      // Ảnh vừa tải lên làm tăng version: luôn đọc lại ngay trước khi PUT.
      const current = await getDraft(draft.draftId);
      setDraft(current);
      const fresh = await updateDraft(current.draftId, {
        variants: skus.map((v) => ({ color: v.color, size: v.size })),
        expectedVersion: current.version,
      });
      setDraft(fresh);
      setSkus(variantsOf(fresh));
      setNotice("Đã lưu biến thể vào Draft."); toast.success("Đã lưu biến thể vào Draft.");
    } catch (failure) {
      if (failure instanceof CatalogAdminError && failure.status === 409) {
        setMessage("Draft đã đổi ở nơi khác. Đã tải lại; kiểm tra rồi lưu lại.");
        await load();
        return;
      }
      setMessage(failure instanceof Error ? failure.message : "Không lưu được biến thể.");
    } finally {
      setBusy(false);
    }
  }

  async function publish() {
    if (!draft || busy) return;
    setBusy(true); setMessage(""); setNotice("");
    try {
      // Luôn dùng version mới nhất (ảnh/biến thể có thể vừa tăng version).
      const fresh = await getDraft(draft.draftId);
      setDraft(fresh);
      const result = await publishDraft(fresh.draftId, fresh.version);
      setNotice(`Đã Publish sản phẩm #${result.productId}.`); toast.success(`Đã Publish sản phẩm #${result.productId}.`);
      if (result.productId) {
        router.replace(`/quan-tri/san-pham/${result.productId}`);
        return; // stay busy while navigating away
      }
    } catch (failure) {
      if (failure instanceof CatalogAdminError && failure.status === 409) {
        setMessage("Draft vừa thay đổi. Đã tải lại; kiểm tra rồi Publish lại.");
        await load();
        setBusy(false);
        return;
      }
      setMessage(failure instanceof Error ? failure.message : "Không Publish được.");
    }
    setBusy(false);
  }

  const name = typeof draft?.productName === "string" ? draft.productName : "Draft";
  const price = typeof draft?.price === "number" ? draft.price : null;
  const imageUrl = resolveDraftImageUrl(typeof draft?.imageUrl === "string" ? draft.imageUrl : null);

  const imageInput = useRef<HTMLInputElement | null>(null);
  const attrs = [typeof draft?.categoryName === "string" ? draft.categoryName : null, typeof draft?.material === "string" ? draft.material : null, typeof draft?.style === "string" ? draft.style : null].filter(Boolean).join(" · ");
  const description = typeof draft?.description === "string" ? draft.description : "";

  return (
    <AdminShellB active="products" title="Sản phẩm" eyebrow="Vận hành · Draft sản phẩm">
      <Link className="back-link" href="/quan-tri/san-pham">← Về danh sách sản phẩm</Link>
      {state === "loading" ? <div className="form-layout"><div className="form-main"><CardSkeleton height={160} /><CardSkeleton height={220} /></div><div className="form-side"><CardSkeleton height={320} /></div></div> : null}
      {state === "error" ? <p className="catalog-error" role="alert">{message}</p> : null}

      {state === "ready" && draft ? (
        <>
          <div className="page-head pd-head">
            <div className="page-head-title pd-title">
              <h1>{name}</h1>
              <span className="badge t-gray">Draft · v{draft.version}</span>
              <InfoHint>Draft chưa hiển thị với khách hàng. Publish để đưa lên cửa hàng và đồng bộ AI.</InfoHint>
            </div>
            <div className="page-head-actions">
              <Link className="secondary" href={`/quan-tri/san-pham/${draft.draftId}/xem-truoc?draftId=${draft.draftId}`}>Xem trước</Link>
              <button className="primary" type="button" disabled={busy} aria-disabled={busy} onClick={() => void publish()}>
                {busy ? "Đang xử lý…" : "Publish"}
              </button>
            </div>
          </div>
          {message ? <p className="catalog-error" role="alert">{message}</p> : null}

          <div className="form-layout">
            <div className="form-main">
              <section className="form-card" aria-label="Thông tin Draft">
                <h2>Thông tin</h2>
                {price !== null ? <p className="pd-price"><span className="money">{formatNumber(price)}<span className="unit">VND</span></span></p> : null}
                <p className="pd-attrs">{attrs || "Chưa có danh mục"}</p>
                {description ? <p className="order-prose pd-desc open">{description}</p> : <p className="meta">Chưa có mô tả.</p>}
              </section>

              <section className="form-card" aria-label="Biến thể SKU của Draft">
                <div className="pd-sku-head">
                  <h2>Biến thể / SKU <span className="pd-count">{skus.length}</span><InfoHint>Khai báo trong Draft; chỉ trở thành SKU khi Publish.</InfoHint></h2>
                </div>
                <div className="pf-row pf-sku-add">
                  <div className="catalog-field"><label htmlFor="d-colors">Màu (cách nhau bằng dấu phẩy)</label><input id="d-colors" className="catalog-input" value={colors} onChange={(e) => setColors(e.target.value)} placeholder="Đen, Trắng" maxLength={500} /></div>
                  <div className="catalog-field"><label htmlFor="d-sizes">Cỡ (cách nhau bằng dấu phẩy)</label><input id="d-sizes" className="catalog-input" value={sizes} onChange={(e) => setSizes(e.target.value)} placeholder="M, L" maxLength={500} /></div>
                </div>
                <div className="pf-inline-actions">
                  <button className="secondary btn-sm" type="button" onClick={planSkus} disabled={busy}>Thêm tổ hợp</button>
                  <button className="primary btn-sm" type="button" onClick={() => void saveVariants()} disabled={busy} aria-disabled={busy}>Lưu biến thể vào Draft</button>
                </div>
                {skus.length > 0 ? (
                  <div className="table-scroll sticky-head" tabIndex={0} aria-label="Biến thể trong Draft">
                    <table className="review-orders-table fit-table">
                      <thead><tr><th>Màu</th><th>Cỡ</th></tr></thead>
                      <tbody>{skus.map((v, i) => <tr key={i}><td>{v.color ?? "Chưa có"}</td><td>{v.size ?? "Chưa có"}</td></tr>)}</tbody>
                    </table>
                  </div>
                ) : <p className="meta">Chưa có biến thể trong Draft.</p>}
              </section>
            </div>

            <div className="form-side">
              <section className="form-card" aria-label="Ảnh Draft">
                <h2>Ảnh</h2>
                <ImageDrop preview={imageUrl} alt={name} accept={["image/png", "image/jpeg"]} inputRef={imageInput} disabled={busy}
                  onFile={(file) => void upload(file)} onReject={(m) => setMessage(m)} hint="PNG hoặc JPG, tối đa 5MB" />
                {imageUrl ? <div className="pf-image-actions"><button type="button" className="secondary btn-sm" disabled={busy} onClick={() => imageInput.current?.click()}>Đổi ảnh</button></div> : null}
                {notice ? <p className="pf-image-note" role="status">{notice}</p> : null}
              </section>
            </div>
          </div>
        </>
      ) : null}
    </AdminShellB>
  );
}
