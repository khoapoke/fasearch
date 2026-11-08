"use client";
import { ImageDrop, ImagePreview, imageSrc } from "@/components/admin-b/image-drop";
import { AdminModal } from "@/components/admin-b/modal";
import { CardSkeleton } from "@/components/admin-b/skeleton";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { AdminShellB } from "@/components/admin-b/admin-shell";
import { useAdminCan } from "@/components/admin-b/use-admin-role";
import { createVariant, deleteProduct, deleteVariant, getBarcode, getProduct, updateProduct, updateVariant, uploadProductImage, type Product, type Variant } from "@/lib/admin-catalog-client";
import { DeleteReasonPanel } from "@/components/admin-b/delete-reason-panel";
import { ProductPublication } from "@/components/admin/product-publication";
import { StatusBadge } from "@/components/admin-b/status-badge";
import { ConfirmDialog } from "@/components/admin-b/confirm-dialog";
import { InfoHint } from "@/components/admin-b/info-hint";
import { useToast } from "@/components/admin-b/toast";
import { formatNumber } from "@/lib/admin-format";
import { buildSkuCombinations } from "@/lib/sku-combinations";
/** A product that is already "Ngừng kinh doanh" must not be told to switch to it again. */
function withoutStopAdvice(message: string): string {
  const out = message.replace(/,?\s*(?:hoặc\s+)?(?:[Hh]ãy\s+)?dùng\s+"Ngừng kinh doanh"[^.]*\./, "").trim();
  return /[.!?]$/.test(out) ? out : `${out}.`;
}

const STATUS: Record<string, string> = { DRAFT: "Draft", ACTIVE: "Đang bán", OUT_OF_STOCK: "Tạm hết hàng", DISCONTINUED: "Ngừng kinh doanh" };
function sellable(p: { status: string }) { return p.status === "ACTIVE" || p.status === "OUT_OF_STOCK"; }
function detailStatusKey(p: { status: string; publicationStatus?: string | null }): string {
  if (sellable(p) && p.publicationStatus === "UNPUBLISHED") return "UNPUBLISHED";
  if (sellable(p) && p.publicationStatus === "DRAFT") return "DRAFT";
  return p.status;
}
function detailStatusLabel(p: { status: string; publicationStatus?: string | null }): string {
  if (sellable(p) && p.publicationStatus === "UNPUBLISHED") return "Đã Unpublish";
  if (sellable(p) && p.publicationStatus === "DRAFT") return "Chưa Publish";
  return STATUS[p.status] ?? p.status;
}
export default function ProductDetailPage() {
  const params = useParams<{ id: string }>(); const id = params?.id ?? ""; const can = useAdminCan(); const router = useRouter();
  const [product, setProduct] = useState<Product | null>(null); const [error, setError] = useState(""); const [loading, setLoading] = useState(true);
  const [color, setColor] = useState(""); const [size, setSize] = useState(""); const [barcode, setBarcode] = useState(""); const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<number | null>(null); const [editColor, setEditColor] = useState(""); const [editSize, setEditSize] = useState(""); const [editBarcode, setEditBarcode] = useState("");
  const [barcodeFor, setBarcodeFor] = useState<Variant | null>(null);
  const [barcodeData, setBarcodeData] = useState<{ text: string | null; image: string | null } | null>(null);
  const [barcodeLoading, setBarcodeLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [modal, setModal] = useState<"" | "sku" | "bulk" | "image">("");
  const [modalError, setModalError] = useState("");
  const [descOpen, setDescOpen] = useState(false);
  const [pickedImage, setPickedImage] = useState<{ file: File; url: string } | null>(null);
  const imageInput = useRef<HTMLInputElement | null>(null);
  const [genColors, setGenColors] = useState("");
  const [genSizes, setGenSizes] = useState("");
  const [genPreview, setGenPreview] = useState<Array<{ color: string | null; size: string | null }> | null>(null);
  const [genSkipped, setGenSkipped] = useState(0);
  const [deleteTarget, setDeleteTarget] = useState<{ kind: "product"; name: string } | { kind: "variant"; id: number; name: string } | null>(null);
  const [deleteIssue, setDeleteIssue] = useState("");
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [stopOpen, setStopOpen] = useState(false);
  const [stopError, setStopError] = useState("");
  const toast = useToast();
  function fail(message: string) { setError(message); toast.error(message); }
  async function load() { setLoading(true); setError(""); try { setProduct(await getProduct(id)); } catch (e) { fail(e instanceof Error ? e.message : "Không tải được sản phẩm."); } finally { setLoading(false); } }
  useEffect(() => { const c = new AbortController(); getProduct(id, c.signal).then(setProduct).catch((e) => { if (!c.signal.aborted) setError(e instanceof Error ? e.message : "Không tải được sản phẩm."); }).finally(() => { if (!c.signal.aborted) setLoading(false); }); return () => c.abort(); }, [id]);
  function openModal(kind: "sku" | "bulk" | "image") { setModalError(""); setModal(kind); }
  function closeModal() {
    if (busy || uploading) return;
    setModal(""); setModalError("");
    if (pickedImage) { URL.revokeObjectURL(pickedImage.url); setPickedImage(null); }
  }
  function modalFail(message: string) { setModalError(message); toast.error(message); }
  async function addSku(e: React.FormEvent) {
    e.preventDefault(); if (busy) return;
    setModalError("");
    if (!color.trim() || !size.trim()) { setModalError("Nhập màu và cỡ."); return; }
    setBusy(true); setError("");
    try { await createVariant(id, { color: color.trim(), size: size.trim(), ...(barcode.trim() ? { barcode: barcode.trim() } : {}) }); setColor(""); setSize(""); setBarcode(""); setModal(""); toast.success("Đã thêm SKU."); await load(); }
    catch (e) { modalFail(e instanceof Error ? e.message : "Không thêm được SKU."); } finally { setBusy(false); }
  }
  async function saveSku(v: Variant) { if (busy) return; setBusy(true); setError(""); try { await updateVariant(v.skuId, { color: editColor.trim(), size: editSize.trim(), ...(editBarcode.trim() ? { barcode: editBarcode.trim() } : {}) }); setEditing(null); toast.success("Đã cập nhật SKU."); await load(); } catch (e) { fail(e instanceof Error ? e.message : "Không cập nhật được SKU."); } finally { setBusy(false); } }
  async function showBarcode(v: Variant) {
    setBarcodeFor(v); setBarcodeData(null); setBarcodeLoading(true); setError("");
    try { const b = await getBarcode(v.skuId); setBarcodeData({ text: b.barcode, image: b.barcodeBase64 ? (b.barcodeBase64.startsWith("data:") ? b.barcodeBase64 : `data:image/png;base64,${b.barcodeBase64}`) : null }); }
    catch (e) { setBarcodeFor(null); fail(e instanceof Error ? e.message : "Không đọc được Barcode."); }
    finally { setBarcodeLoading(false); }
  }
  async function uploadPicked() {
    if (!pickedImage || !product || busy || uploading) return;
    setUploading(true); setError(""); setModalError("");
    try { const url = await uploadProductImage(id, pickedImage.file); setProduct({ ...product, imageUrl: url }); URL.revokeObjectURL(pickedImage.url); setPickedImage(null); setModal(""); toast.success("Đã đổi ảnh sản phẩm."); }
    catch (err) { modalFail(err instanceof Error ? err.message : "Không tải được ảnh."); }
    finally { setUploading(false); }
  }
  async function generateSkus() {
    if (busy || !genPreview) return; setBusy(true); setError(""); setModalError("");
    try { for (const row of genPreview) { await createVariant(id, { color: row.color, size: row.size }); } const n = genPreview.length; setGenPreview(null); setGenColors(""); setGenSizes(""); setModal(""); toast.success(`Đã thêm ${n} SKU.`); await load(); }
    catch (err) { modalFail(err instanceof Error ? err.message : "Không thêm được SKU hàng loạt."); await load(); }
    finally { setBusy(false); }
  }
  function previewSkus(e: React.FormEvent) {
    e.preventDefault(); if (busy || !product) return;
    const colors = genColors.split(",").map((v) => v.trim()).filter(Boolean);
    const sizes = genSizes.split(",").map((v) => v.trim()).filter(Boolean);
    if (!colors.length || !sizes.length) { setModalError("Nhập ít nhất một màu và một cỡ, cách nhau bằng dấu phẩy."); return; }
    const { combinations, skippedDuplicate } = buildSkuCombinations(colors, sizes, product.variants ?? []);
    setGenPreview(combinations); setGenSkipped(skippedDuplicate); setModalError("");
    if (!combinations.length) setModalError(skippedDuplicate > 0 ? `Tất cả ${skippedDuplicate} tổ hợp đã tồn tại — không có gì để thêm.` : "Không có tổ hợp hợp lệ.");
  }
  async function confirmDelete(reason: string) {
    if (!deleteTarget || deleteBusy) return;
    setDeleteBusy(true); setDeleteIssue("");
    try {
      if (deleteTarget.kind === "product") { await deleteProduct(id, reason); toast.success("Đã xóa sản phẩm. Có thể khôi phục trong thùng rác."); router.push("/quan-tri/san-pham"); return; }
      await deleteVariant(deleteTarget.id, reason);
      setDeleteTarget(null);
      toast.success("Đã xóa SKU. Có thể khôi phục trong thùng rác.");
      await load();
    } catch (e) {
      const raw = e instanceof Error && e.message ? e.message : "Không xóa được. Thử lại.";
      setDeleteIssue(deleteTarget.kind === "product" && product?.status === "DISCONTINUED" ? withoutStopAdvice(raw) : raw);
    } finally { setDeleteBusy(false); }
  }
  async function stopSelling() {
    if (deleteBusy) return;
    setDeleteBusy(true); setDeleteIssue(""); setStopError(""); setError("");
    try {
      await updateProduct(id, { status: "DISCONTINUED" });
      setDeleteTarget(null); setStopOpen(false);
      toast.success("Đã chuyển sang Ngừng kinh doanh. Dữ liệu và lịch sử được giữ nguyên.");
      await load();
    } catch (e) {
      const message = e instanceof Error && e.message ? e.message : "Không chuyển được sang Ngừng kinh doanh.";
      setDeleteIssue(message); setStopError(message); toast.error(message);
    } finally { setDeleteBusy(false); }
  }
  const manage = can("PRODUCT_EDIT"); const canDelete = can("PRODUCT_DELETE"); const canPublish = can("PRODUCT_PUBLISH");
  const variants = product?.variants ?? [];
  const desc = product?.description ?? "";
  const longDesc = desc.length > 220 || descriptionLines(desc).length > 3;
  return <AdminShellB active="products" title="Sản phẩm" eyebrow="Vận hành · sản phẩm">
    <Link className="back-link" href="/quan-tri/san-pham">← Về danh sách sản phẩm</Link>
    {loading && !product ? <><div className="pd-skel"><CardSkeleton height={48} /></div><div className="pd-top"><CardSkeleton height={220} /><CardSkeleton height={220} /><CardSkeleton height={220} /></div></> : null}
    {error && !product ? <p className="catalog-error" role="alert">{error}</p> : null}
    <DeleteReasonPanel
      open={deleteTarget !== null}
      title={deleteTarget?.kind === "variant" ? "Xóa SKU này?" : "Xóa sản phẩm này?"}
      target={deleteTarget?.name ?? ""}
      consequence={deleteTarget?.kind === "variant"
        ? "SKU sẽ được ẩn khỏi vận hành và chuyển vào thùng rác; dữ liệu không bị xóa vĩnh viễn và có thể khôi phục ở mục Thùng rác. SKU còn tồn kho, đã bán hoặc đã dùng trong phiếu kho sẽ bị từ chối."
        : `Sản phẩm cùng các SKU sẽ được ẩn khỏi cửa hàng và chuyển vào thùng rác; dữ liệu không bị xóa vĩnh viễn. Khôi phục sẽ đưa sản phẩm về Ngừng kinh doanh và Chưa Publish, phải Publish lại mới bán được. Sản phẩm đã bán, còn tồn kho hoặc đã dùng trong phiếu kho sẽ bị từ chối${product?.status === "DISCONTINUED" ? "." : ". Khi đó hãy dùng \"Ngừng kinh doanh\"."}`}
      busy={deleteBusy}
      refusal={deleteIssue}
      onClose={() => { if (!deleteBusy) { setDeleteTarget(null); setDeleteIssue(""); } }}
      onConfirm={(reason) => void confirmDelete(reason)}
      alternative={deleteTarget?.kind === "product" && product && product.status !== "DISCONTINUED" && product.publicationStatus !== "PUBLISHED" && deleteIssue
        ? { label: "Ngừng kinh doanh", hint: "Giữ sản phẩm và lịch sử, chỉ ngừng bán.", onClick: () => void stopSelling() }
        : undefined}
    />
    <ConfirmDialog
      open={stopOpen}
      title="Ngừng kinh doanh sản phẩm này?"
      message={`${product?.productName ?? "Sản phẩm"} sẽ ngừng bán. Dữ liệu và lịch sử đơn hàng được giữ nguyên.`}
      confirmLabel="Ngừng kinh doanh"
      tone="danger"
      busy={deleteBusy}
      error={stopError}
      onConfirm={() => void stopSelling()}
      onClose={() => { if (!deleteBusy) setStopOpen(false); }}
    />
    {product ? <>
      <div className="page-head pd-head">
        <div className="page-head-title pd-title">
          <h1>{product.productName}</h1>
          <StatusBadge status={detailStatusKey(product)} label={detailStatusLabel(product)} />
          <span className="pd-cat">{product.categoryName ?? "Chưa có danh mục"}</span>
        </div>
        {manage || canDelete ? <div className="page-head-actions">
          {manage ? <Link className="primary" href={`/quan-tri/san-pham/${product.id}/sua`}>Sửa sản phẩm</Link> : null}
          {manage && product.status !== "DISCONTINUED" && product.publicationStatus !== "PUBLISHED" ? <button className="secondary" type="button" disabled={busy || deleteBusy} onClick={() => { setStopError(""); setStopOpen(true); }}>Ngừng kinh doanh</button> : null}
          {canDelete ? <button className="danger" type="button" disabled={busy || product.publicationStatus === "PUBLISHED"} onClick={() => { setDeleteIssue(""); setDeleteTarget({ kind: "product", name: product.productName }); }}>Xóa sản phẩm</button> : null}
          {canDelete && product.publicationStatus === "PUBLISHED" ? <InfoHint align="end">Unpublish trước khi xóa</InfoHint> : null}
        </div> : null}
      </div>
      {error ? <p className="catalog-error" role="alert">{error}</p> : null}
      <div className={`pd-top${canPublish ? "" : " no-pub"}`}>
        <section className="pd-card pd-image" aria-label="Ảnh sản phẩm"><ImagePreview src={imageSrc(product.imageUrl)} alt={product.productName} /></section>
        <section className="pd-card pd-info" aria-label="Thông tin sản phẩm">
          <p className="pd-label">Giá bán</p>
          <p className="pd-price"><span className="money">{formatNumber(product.price)}<span className="unit">VND</span></span></p>
          {[product.material, product.style].filter(Boolean).length ? <p className="pd-attrs">{[product.material, product.style].filter(Boolean).join(" · ")}</p> : null}
          {desc ? <>
            <div className={`product-description pd-desc${descOpen ? " open" : ""}`}>{descriptionLines(desc).map((line, index) => <span key={`${line}-${index}`}>{line}</span>)}</div>
            {longDesc ? <button className="pd-more" type="button" aria-expanded={descOpen} onClick={() => setDescOpen((v) => !v)}>{descOpen ? "Thu gọn" : "Xem thêm"}</button> : null}
          </> : <p className="meta">Chưa có mô tả.</p>}
        </section>
        {canPublish ? <ProductPublication product={product} onChanged={setProduct} /> : null}
      </div>
      <section className="workbench pd-sku" aria-label="Biến thể SKU">
        <div className="pd-sku-head">
          <h2>Biến thể / SKU <span className="pd-count">{variants.length}</span>{product.status === "ACTIVE" ? <InfoHint>Sản phẩm đang bán: sửa SKU phải đi qua Draft để không đổi mã đã dùng trong đơn.</InfoHint> : null}</h2>
          {manage ? <div className="pd-sku-actions">
            {variants.length > 0 ? <Link className="secondary btn-sm s2-print-link" href={`/quan-tri/in-tem?items=${variants.map((v) => `${v.skuId}:1`).join(",")}`}>In tem</Link> : null}
            <button className="secondary btn-sm" type="button" onClick={() => openModal("sku")}>Thêm SKU</button>
            <button className="secondary btn-sm" type="button" onClick={() => openModal("bulk")}>Sinh hàng loạt</button>
            <button className="secondary btn-sm" type="button" onClick={() => openModal("image")}>Đổi ảnh</button>
          </div> : <span className="meta">Tài khoản hiện tại chỉ đọc.</span>}
        </div>
        {variants.length > 0 ? <div className="table-scroll sticky-head review-table-scroll table-cards" tabIndex={0}><table className="review-orders-table fit-table"><thead><tr><th>SKU</th><th>Màu</th><th>Cỡ</th><th>Barcode</th><th className="num">Thao tác</th></tr></thead><tbody>{variants.map((v) => <tr key={v.skuId}>{editing === v.skuId ? <><td data-label="SKU" className="num-cell">{v.skuId}</td><td data-label="Màu"><input className="catalog-input" value={editColor} onChange={(e) => setEditColor(e.target.value)} aria-label="Màu" /></td><td data-label="Cỡ"><input className="catalog-input" value={editSize} onChange={(e) => setEditSize(e.target.value)} aria-label="Cỡ" /></td><td data-label="Barcode"><input className="catalog-input" value={editBarcode} onChange={(e) => setEditBarcode(e.target.value)} aria-label="Barcode" /></td><td data-label="Thao tác" className="num"><div className="row-actions end"><button className="primary btn-sm" type="button" disabled={busy} onClick={() => saveSku(v)}>Lưu</button><button className="secondary btn-sm" type="button" onClick={() => setEditing(null)}>Hủy</button></div></td></> : <><td data-label="SKU" className="num-cell">{v.skuId}</td><td data-label="Màu">{v.color ?? <span className="empty-value">Chưa có</span>}</td><td data-label="Cỡ">{v.size ?? <span className="empty-value">Chưa có</span>}</td><td data-label="Barcode" className="pd-barcode">{v.barcode ?? <span className="empty-value">Chưa có</span>}</td><td data-label="Thao tác" className="num"><div className="row-actions end"><button className="secondary btn-sm" type="button" onClick={() => void showBarcode(v)}>Barcode</button>{manage && product.status !== "ACTIVE" ? <button className="secondary btn-sm" type="button" onClick={() => { setEditing(v.skuId); setEditColor(v.color ?? ""); setEditSize(v.size ?? ""); setEditBarcode(v.barcode ?? ""); }}>Sửa</button> : null}{canDelete ? <button className="danger btn-sm" type="button" disabled={busy} onClick={() => { setDeleteIssue(""); setDeleteTarget({ kind: "variant", id: v.skuId, name: `${product.productName} · ${[v.color, v.size].filter(Boolean).join(" / ") || `SKU ${v.skuId}`}` }); }}>Xóa</button> : null}</div></td></>}</tr>)}</tbody></table></div> : <div className="order-empty"><strong>Chưa có SKU</strong><p>{manage ? "Bấm Thêm SKU để tạo biến thể đầu tiên." : "Cần quyền Quản trị viên hoặc Quản lý để tạo SKU."}</p></div>}
      </section>

      <AdminModal open={modal === "sku"} title="Thêm SKU" size="sm" busy={busy} onClose={closeModal}
        footer={<><button className="secondary" type="button" disabled={busy} onClick={closeModal}>Hủy</button><button className="primary" type="submit" form="sku-form" disabled={busy}>{busy ? "Đang thêm…" : "Thêm SKU"}</button></>}>
        <form id="sku-form" className="catalog-form" onSubmit={addSku} noValidate>
          <div className="catalog-field"><label htmlFor="sku-color">Màu *</label><input id="sku-color" className="catalog-input" value={color} maxLength={50} onChange={(e) => setColor(e.target.value)} autoFocus /></div>
          <div className="catalog-field"><label htmlFor="sku-size">Cỡ *</label><input id="sku-size" className="catalog-input" value={size} maxLength={50} onChange={(e) => setSize(e.target.value)} /></div>
          <div className="catalog-field"><label htmlFor="sku-barcode">Barcode</label><input id="sku-barcode" className="catalog-input" value={barcode} maxLength={100} onChange={(e) => setBarcode(e.target.value)} placeholder="Để trống để hệ thống tự tạo" /></div>
          {modalError ? <p className="catalog-error" role="alert">{modalError}</p> : null}
        </form>
      </AdminModal>

      <AdminModal open={modal === "bulk"} title="Sinh SKU hàng loạt" description="Tạo mọi tổ hợp màu và cỡ; tổ hợp đã có được bỏ qua." size="md" busy={busy} onClose={closeModal}
        footer={<><button className="secondary" type="button" disabled={busy} onClick={closeModal}>Hủy</button>{genPreview && genPreview.length > 0 ? <button className="primary" type="button" disabled={busy} onClick={() => void generateSkus()}>{busy ? "Đang thêm…" : `Thêm ${genPreview.length} SKU`}</button> : <button className="primary" type="submit" form="gen-form" disabled={busy}>Xem trước tổ hợp</button>}</>}>
        <form id="gen-form" className="catalog-form" aria-label="Sinh SKU theo màu × cỡ" onSubmit={previewSkus} noValidate>
          <div className="catalog-field"><label htmlFor="gen-colors">Màu (cách nhau bằng dấu phẩy)</label><input id="gen-colors" className="catalog-input" value={genColors} maxLength={500} onChange={(e) => { setGenColors(e.target.value); setGenPreview(null); }} placeholder="Đen, Trắng" autoFocus /></div>
          <div className="catalog-field"><label htmlFor="gen-sizes">Cỡ (cách nhau bằng dấu phẩy)</label><input id="gen-sizes" className="catalog-input" value={genSizes} maxLength={500} onChange={(e) => { setGenSizes(e.target.value); setGenPreview(null); }} placeholder="S, M, L" /></div>
        </form>
        {modalError ? <p className="catalog-error" role="alert">{modalError}</p> : null}
        {genPreview && genPreview.length > 0 ? <div className="pd-gen-preview"><div className="table-scroll" tabIndex={0} aria-label="Tổ hợp SKU sẽ thêm"><table className="review-orders-table two-col-table"><thead><tr><th>Màu</th><th>Cỡ</th></tr></thead><tbody>{genPreview.map((row, i) => <tr key={i}><td>{row.color ?? "Chưa có"}</td><td>{row.size ?? "Chưa có"}</td></tr>)}</tbody></table></div>
          <p className="meta">{genPreview.length} tổ hợp mới{genSkipped > 0 ? ` · bỏ qua ${genSkipped} tổ hợp đã tồn tại` : ""}.</p></div> : null}
      </AdminModal>

      <AdminModal open={modal === "image"} title="Đổi ảnh sản phẩm" description="Ảnh JPG, PNG hoặc WebP, tối đa 5MB." size="sm" busy={uploading} onClose={closeModal}
        footer={<><button className="secondary" type="button" disabled={uploading} onClick={closeModal}>Hủy</button>{pickedImage ? <button className="secondary" type="button" disabled={uploading} onClick={() => imageInput.current?.click()}>Chọn ảnh khác</button> : null}<button className="primary" type="button" disabled={!pickedImage || uploading} onClick={() => void uploadPicked()}>{uploading ? "Đang tải…" : "Tải ảnh lên"}</button></>}>
        <ImageDrop preview={pickedImage?.url ?? imageSrc(product.imageUrl)} alt={product.productName} accept={["image/jpeg", "image/png", "image/webp"]} inputRef={imageInput} disabled={uploading}
          onFile={(file) => { if (pickedImage) URL.revokeObjectURL(pickedImage.url); setModalError(""); setPickedImage({ file, url: URL.createObjectURL(file) }); }}
          onReject={(m) => setModalError(m)} />
        {!pickedImage ? <button className="secondary btn-sm pd-pick" type="button" onClick={() => imageInput.current?.click()}>Chọn ảnh mới</button> : null}
        {modalError ? <p className="catalog-error" role="alert">{modalError}</p> : null}
      </AdminModal>

      <AdminModal open={barcodeFor !== null} title="Barcode" description={barcodeFor ? [product.productName, barcodeFor.color, barcodeFor.size].filter(Boolean).join(" · ") : undefined} size="sm" onClose={() => setBarcodeFor(null)}
        footer={<>{barcodeFor ? <Link className="secondary" href={`/quan-tri/in-tem?items=${barcodeFor.skuId}:1`}>In tem</Link> : null}<button className="secondary" type="button" onClick={() => setBarcodeFor(null)}>Đóng</button></>}>
        {barcodeLoading ? <CardSkeleton height={120} /> : barcodeData ? <div className="pd-barcode-box"><strong className="pd-barcode-text">{barcodeData.text ?? "Chưa có Barcode"}</strong>{barcodeData.image ? (
          // eslint-disable-next-line @next/next/no-img-element -- barcode PNG data from BE, not an uploaded file
          <img src={barcodeData.image} alt="Barcode SKU" />
        ) : null}</div> : null}
      </AdminModal>
    </> : null}</AdminShellB>;
}
function descriptionLines(value: string): string[] {
  const lines = value.split(/\s+(?=(?:Dòng sản phẩm|Mã SKU|Chất liệu|Màu sắc|Giới tính):)/).map((line) => line.trim()).filter(Boolean);
  return lines.length ? lines : [value];
}
