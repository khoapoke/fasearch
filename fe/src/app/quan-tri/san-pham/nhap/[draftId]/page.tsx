"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { AdminShellB } from "@/components/admin-b/admin-shell";
import { ProductImage } from "@/components/admin-b/product-image";
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
  const draftId = Number(params?.draftId ?? "");
  const router = useRouter();
  const [draft, setDraft] = useState<AdminDraft | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [message, setMessage] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [colors, setColors] = useState("");
  const [sizes, setSizes] = useState("");
  const [skus, setSkus] = useState<DraftVariant[]>([]);

  const load = useCallback(async () => {
    if (!Number.isSafeInteger(draftId) || draftId < 1) {
      setState("error");
      setMessage("Mã bản nháp chưa hợp lệ.");
      return;
    }
    setState("loading");
    try {
      const fresh = await getDraft(draftId);
      setDraft(fresh);
      setSkus(variantsOf(fresh));
      setState("ready");
    } catch (failure) {
      setState("error");
      setMessage(failure instanceof Error ? failure.message : "Không tải được bản nháp.");
    }
  }, [draftId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function upload(file: File) {
    if (!draft || busy) return;
    setBusy(true); setMessage(""); setNotice("");
    try {
      const result = await uploadDraftImage(draft.draftId, file);
      if (result?.imageUrl) {
        // Tải ảnh làm tăng version: đọc lại để không tự 409 khi lưu/xuất bản.
        const fresh = await getDraft(draft.draftId);
        setDraft(fresh);
        setNotice("Đã tải ảnh vào bản nháp (phiên bản mới). Bấm Xuất bản để đưa lên catalog.");
      } else {
        setNotice("Máy chủ đã nhận ảnh nhưng không trả URL; kiểm tra lại bản nháp.");
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
      setNotice("Đã lưu biến thể vào bản nháp.");
    } catch (failure) {
      if (failure instanceof CatalogAdminError && failure.status === 409) {
        setMessage("Bản nháp đã đổi ở nơi khác (409). Đã tải lại — kiểm tra rồi lưu lại.");
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
      setNotice(`Đã xuất bản sản phẩm #${result.productId}. Trạng thái AI: ${String((result as { aiSync?: unknown }).aiSync ?? "PENDING")}.`);
      if (result.productId) {
        router.replace(`/quan-tri/san-pham/${result.productId}`);
      }
    } catch (failure) {
      if (failure instanceof CatalogAdminError && failure.status === 409) {
        setMessage("Bản nháp vừa thay đổi (409). Đã tải lại — kiểm tra rồi xuất bản lại.");
        await load();
        return;
      }
      setMessage(failure instanceof Error ? failure.message : "Không xuất bản được.");
    } finally {
      setBusy(false);
    }
  }

  const name = typeof draft?.productName === "string" ? draft.productName : "Bản nháp";
  const price = typeof draft?.price === "number" ? draft.price : null;
  const imageUrl = resolveDraftImageUrl(typeof draft?.imageUrl === "string" ? draft.imageUrl : null);

  return (
    <AdminShellB active="products" title="Bản nháp sản phẩm" eyebrow="Vận hành · bản nháp chưa công khai">
      <div className="page-heading">
        <div>
          <h1>Bản nháp sản phẩm</h1>
          <p className="meta">Chưa hiển thị với khách hàng. Xuất bản để đưa lên catalog và đồng bộ AI.</p>
        </div>
        <Link className="text-link" href="/quan-tri/san-pham">← Danh sách sản phẩm</Link>
      </div>

      {state === "loading" ? <p className="meta" role="status">Đang tải bản nháp…</p> : null}
      {state === "error" ? <p className="catalog-error" role="alert">{message}</p> : null}

      {state === "ready" && draft ? (
        <>
          <section className="workbench" aria-label="Thông tin bản nháp" style={{ marginBottom: 18 }}>
            <div className="section-head">
              <div>
                <h2>{name}</h2>
                <p className="meta">#{draft.draftId} · phiên bản {draft.version} · {String(draft.draftState ?? draft.status)}</p>
              </div>
              <div className="catalog-inline">
                <Link className="text-link" href={`/quan-tri/san-pham/${draft.draftId}/xem-truoc`}>Xem trước bản nháp</Link>
                <button className="primary" type="button" disabled={busy} aria-disabled={busy} onClick={() => void publish()}>
                  {busy ? "Đang xử lý…" : "Xuất bản"}
                </button>
              </div>
            </div>
            <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
              {imageUrl ? <ProductImage src={imageUrl} alt={name} /> : <p className="meta">Chưa có ảnh.</p>}
              <div>
                {price !== null ? (
                  <p className="money">
                    {price.toLocaleString("vi-VN")} <span className="unit">VND</span>
                  </p>
                ) : null}
                <p className="meta" style={{ marginTop: 8 }}>
                  {[typeof draft.categoryName === "string" ? draft.categoryName : null, typeof draft.material === "string" ? draft.material : null, typeof draft.style === "string" ? draft.style : null].filter(Boolean).join(" · ") || "Chưa có danh mục"}
                </p>
                {typeof draft.description === "string" && draft.description ? <p style={{ marginTop: 8 }}>{String(draft.description)}</p> : null}
              </div>
            </div>
          </section>

          <section className="workbench" aria-label="Ảnh bản nháp" style={{ marginBottom: 18 }}>
            <div className="section-head"><div><h2>Ảnh</h2><p className="meta">PNG/JPG, tối đa 5MB. Ảnh chỉ công khai sau khi xuất bản.</p></div></div>
            <div className="catalog-field">
              <label htmlFor="draft-file">Chọn ảnh</label>
              <input id="draft-file" className="catalog-input" type="file" accept="image/png,image/jpeg" disabled={busy}
                onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void upload(f); }} />
            </div>
          </section>

          <section className="workbench" aria-label="Biến thể SKU của bản nháp">
            <div className="section-head"><div><h2>Biến thể / SKU</h2><p className="meta">Khai báo trong bản nháp; chỉ trở thành SKU thật khi xuất bản.</p></div></div>
            <div className="catalog-field"><label htmlFor="d-colors">Màu (phẩy ngăn cách)</label><input id="d-colors" className="catalog-input" value={colors} onChange={(e) => setColors(e.target.value)} placeholder="Đen, Trắng" maxLength={500} /></div>
            <div className="catalog-field"><label htmlFor="d-sizes">Cỡ (phẩy ngăn cách)</label><input id="d-sizes" className="catalog-input" value={sizes} onChange={(e) => setSizes(e.target.value)} placeholder="M, L" maxLength={500} /></div>
            <div className="catalog-actions">
              <button className="text-link" type="button" onClick={planSkus} disabled={busy}>Thêm tổ hợp</button>
              <button className="primary" type="button" onClick={() => void saveVariants()} disabled={busy} aria-disabled={busy}>Lưu biến thể vào bản nháp</button>
            </div>
            {skus.length > 0 ? (
              <div className="table-scroll" tabIndex={0} aria-label="Biến thể trong bản nháp">
                <table className="review-orders-table">
                  <thead><tr><th>Màu</th><th>Cỡ</th></tr></thead>
                  <tbody>{skus.map((v, i) => <tr key={i}><td>{v.color ?? "—"}</td><td>{v.size ?? "—"}</td></tr>)}</tbody>
                </table>
              </div>
            ) : <p className="meta">Chưa có biến thể trong bản nháp.</p>}
          </section>

          {message ? <p className="catalog-error" role="alert" style={{ marginTop: 14 }}>{message}</p> : null}
          {notice ? <p className="meta" role="status" style={{ marginTop: 14 }}>{notice}</p> : null}
        </>
      ) : null}
    </AdminShellB>
  );
}
