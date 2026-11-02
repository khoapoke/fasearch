"use client";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AdminShellB } from "@/components/admin-b/admin-shell";
import { ProductImage } from "@/components/admin-b/product-image";
import { useAdminRole } from "@/components/admin-b/use-admin-role";
import { createVariant, deleteProduct, getBarcode, getProduct, updateProduct, updateVariant, uploadProductImage, type Product, type Variant } from "@/lib/admin-catalog-client";
import { ProductPublication } from "@/components/admin/product-publication";
import { buildSkuCombinations } from "@/lib/sku-combinations";
const STATUS: Record<string, string> = { DRAFT: "Nháp", ACTIVE: "Đang bán", OUT_OF_STOCK: "Tạm hết hàng", DISCONTINUED: "Ngừng kinh doanh" };
export default function ProductDetailPage() {
  const params = useParams<{ id: string }>(); const id = params?.id ?? ""; const role = useAdminRole(); const router = useRouter();
  const [product, setProduct] = useState<Product | null>(null); const [error, setError] = useState(""); const [loading, setLoading] = useState(true);
  const [color, setColor] = useState(""); const [size, setSize] = useState(""); const [barcode, setBarcode] = useState(""); const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<number | null>(null); const [editColor, setEditColor] = useState(""); const [editSize, setEditSize] = useState(""); const [editBarcode, setEditBarcode] = useState("");
  const [barcodeData, setBarcodeData] = useState<{ text: string | null; image: string | null } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [genColors, setGenColors] = useState("");
  const [genSizes, setGenSizes] = useState("");
  const [genPreview, setGenPreview] = useState<Array<{ color: string | null; size: string | null }> | null>(null);
  const [genSkipped, setGenSkipped] = useState(0);
  async function load() { setLoading(true); setError(""); try { setProduct(await getProduct(id)); } catch (e) { setError(e instanceof Error ? e.message : "Không tải được sản phẩm."); } finally { setLoading(false); } }
  useEffect(() => { const c = new AbortController(); getProduct(id, c.signal).then(setProduct).catch((e) => { if (!c.signal.aborted) setError(e instanceof Error ? e.message : "Không tải được sản phẩm."); }).finally(() => { if (!c.signal.aborted) setLoading(false); }); return () => c.abort(); }, [id]);
  async function addSku(e: React.FormEvent) { e.preventDefault(); if (busy) return; setBusy(true); setError(""); try { await createVariant(id, { color: color.trim(), size: size.trim(), ...(barcode.trim() ? { barcode: barcode.trim() } : {}) }); setColor(""); setSize(""); setBarcode(""); await load(); } catch (e) { setError(e instanceof Error ? e.message : "Không thêm được SKU."); } finally { setBusy(false); } }
  async function saveSku(v: Variant) { if (busy) return; setBusy(true); setError(""); try { await updateVariant(v.skuId, { color: editColor.trim(), size: editSize.trim(), ...(editBarcode.trim() ? { barcode: editBarcode.trim() } : {}) }); setEditing(null); await load(); } catch (e) { setError(e instanceof Error ? e.message : "Không cập nhật được SKU."); } finally { setBusy(false); } }
  async function showBarcode(v: Variant) { setBarcodeData(null); setError(""); try { const b = await getBarcode(v.skuId); setBarcodeData({ text: b.barcode, image: b.barcodeBase64 ? `data:image/png;base64,${b.barcodeBase64}` : null }); } catch (e) { setError(e instanceof Error ? e.message : "Không đọc được mã vạch."); } }
  async function removeProduct() { if (busy) return; if (!window.confirm("Xóa (ngừng kinh doanh) sản phẩm này? Không thể hoàn tác.")) return; setBusy(true); setError(""); try { await deleteProduct(id); router.push("/quan-tri/san-pham"); } catch (e) { setError(e instanceof Error ? e.message : "Không xóa được sản phẩm."); } finally { setBusy(false); } }
  return <AdminShellB active="products" title="Chi tiết sản phẩm" eyebrow="Vận hành · catalog thật từ BE"><div className="page-heading"><div><h1>Chi tiết sản phẩm</h1><p className="meta">Metadata và SKU thật · không có upload/tồn kho</p></div><Link className="text-link" href="/quan-tri/san-pham">← Danh sách</Link></div>
    {loading ? <p className="meta" role="status">Đang tải…</p> : null}{error ? <p className="catalog-error" role="alert">{error}</p> : null}
    {product ? <><section className="workbench" style={{ marginBottom: 18 }} aria-label="Thông tin sản phẩm"><div className="section-head"><div><h2>{product.productName}</h2><p className="meta">#{product.id} · {product.categoryName ?? "Chưa có danh mục"} · {STATUS[product.status] ?? product.status}</p></div>{role === "ADMIN" ? <Link className="primary" href={`/quan-tri/san-pham/${product.id}/sua`}>Sửa metadata</Link> : null}{role === "ADMIN" ? <button className="text-link" type="button" disabled={busy} onClick={removeProduct} style={{ marginLeft: 8, color: "#b42318" }}>Xóa / ngừng kinh doanh</button> : null}</div><div style={{ display: "flex", gap: 16, alignItems: "start" }}><ProductImage src={product.imageUrl} alt={product.productName} /><div><p className="meta">Giá bán</p><strong><span className="money">{product.price.toLocaleString("vi-VN")}<span className="unit">VND</span></span></strong><p className="meta" style={{ marginTop: 8 }}>{[product.material, product.style].filter(Boolean).join(" · ") || "Chất liệu/kiểu dáng: chưa có"}</p>{product.description ? <p style={{ marginTop: 8 }}>{product.description}</p> : null}<p className="meta" style={{ marginTop: 8 }}>Ảnh từ URL do BE trả về; không có upload. Tồn kho/vị trí chưa có trong DTO.</p></div></div></section>
      {role === "ADMIN" && product ? <ProductPublication product={product} onChanged={setProduct} /> : null}
      <section className="workbench" aria-label="Biến thể SKU"><div className="section-head"><div><h2>Biến thể / SKU</h2><p className="meta">Màu · kích cỡ · mã vạch · ID do BE giữ</p></div></div><div className="table-scroll review-table-scroll" tabIndex={0}><table className="review-orders-table"><thead><tr><th>SKU</th><th>Màu</th><th>Cỡ</th><th>Barcode</th><th>Hành động</th></tr></thead><tbody>{(product.variants ?? []).map((v) => <tr key={v.skuId}>{editing === v.skuId ? <><td>{v.skuId}</td><td><input className="catalog-input" value={editColor} onChange={(e) => setEditColor(e.target.value)} aria-label="Màu" /></td><td><input className="catalog-input" value={editSize} onChange={(e) => setEditSize(e.target.value)} aria-label="Cỡ" /></td><td><input className="catalog-input" value={editBarcode} onChange={(e) => setEditBarcode(e.target.value)} aria-label="Barcode" /></td><td className="catalog-inline"><button className="primary" type="button" disabled={busy} onClick={() => saveSku(v)}>Lưu</button><button className="text-link" type="button" onClick={() => setEditing(null)}>Hủy</button></td></> : <><td>{v.skuId}</td><td>{v.color ?? "—"}</td><td>{v.size ?? "—"}</td><td>{v.barcode ?? "—"}</td><td className="catalog-inline"><button className="text-link" type="button" onClick={() => showBarcode(v)}>Mã vạch</button>{role === "ADMIN" && product.status !== "ACTIVE" ? <button className="text-link" type="button" onClick={() => { setEditing(v.skuId); setEditColor(v.color ?? ""); setEditSize(v.size ?? ""); setEditBarcode(v.barcode ?? ""); }}>Sửa SKU</button> : null}</td></>}</tr>)}</tbody></table></div>{(product.variants ?? []).length === 0 ? <p className="meta">Chưa có SKU. Tạo SKU bằng form bên dưới{nrole(role)}.</p> : null}
        {product.status === "ACTIVE" ? <p className="meta" style={{ marginTop: 8 }}>Sản phẩm đang bán: sửa SKU phải đi qua bản nháp (nút Xuất bản ở trên), không sửa trực tiếp để tránh 409 và mất tham chiếu đơn hàng.</p> : null}</section>
      {role === "ADMIN" ? <form className="catalog-form" onSubmit={addSku} style={{ marginTop: 18 }}><h2>Thêm SKU</h2><div className="catalog-field"><label htmlFor="sku-color">Màu *</label><input id="sku-color" className="catalog-input" value={color} maxLength={50} onChange={(e) => setColor(e.target.value)} /></div><div className="catalog-field"><label htmlFor="sku-size">Cỡ *</label><input id="sku-size" className="catalog-input" value={size} maxLength={50} onChange={(e) => setSize(e.target.value)} /></div><div className="catalog-field"><label htmlFor="sku-barcode">Barcode (để trống để BE tạo)</label><input id="sku-barcode" className="catalog-input" value={barcode} maxLength={100} onChange={(e) => setBarcode(e.target.value)} /></div><div className="catalog-actions"><button className="primary" type="submit" disabled={busy}>{busy ? "Đang thêm…" : "Thêm SKU"}</button></div></form> : <p className="meta">STAFF chỉ đọc; không có form thêm/sửa SKU.</p>}
      {role === "ADMIN" && product ? <>
        <form className="workbench" aria-label="Tải ảnh sản phẩm" style={{ marginTop: 18 }} onSubmit={async (e) => {
          e.preventDefault();
          const input = (e.currentTarget.elements.namedItem("p-image") as HTMLInputElement | null);
          const file = input?.files?.[0];
          if (!file || busy || uploading) return;
          setUploading(true); setError("");
          try { const url = await uploadProductImage(id, file); setProduct({ ...product, imageUrl: url }); }
          catch (err) { setError(err instanceof Error ? err.message : "Không tải được ảnh."); }
          finally { setUploading(false); }
        }}>
          <div className="section-head"><div><h2>Ảnh sản phẩm</h2><p className="meta">Xem trước ở trình duyệt; máy chủ kiểm tra byte/loại/kích thước, tên file an toàn.</p></div></div>
          <div className="catalog-field"><label htmlFor="p-image">Chọn ảnh (JPG/PNG/WebP, tối đa theo BE)</label><input id="p-image" name="p-image" className="catalog-input" type="file" accept="image/jpeg,image/png,image/webp" /></div>
          <div className="catalog-actions"><button className="primary" type="submit" disabled={busy || uploading}>{uploading ? "Đang tải…" : "Tải ảnh lên"}</button></div>
        </form>
        <form className="workbench" aria-label="Sinh SKU theo màu × cỡ" style={{ marginTop: 18 }} onSubmit={async (e) => {
          e.preventDefault();
          if (busy) return;
          const colors = genColors.split(",").map((v) => v.trim()).filter(Boolean);
          const sizes = genSizes.split(",").map((v) => v.trim()).filter(Boolean);
          if (!colors.length || !sizes.length) { setError("Nhập ít nhất một màu và một cỡ, cách nhau bằng dấu phẩy."); return; }
          const { combinations, skippedDuplicate } = buildSkuCombinations(colors, sizes, product.variants ?? []);
          setGenPreview(combinations); setGenSkipped(skippedDuplicate); setError("");
          if (!combinations.length) setError(skippedDuplicate > 0 ? `Tất cả ${skippedDuplicate} tổ hợp đã tồn tại — không có gì để thêm.` : "Không có tổ hợp hợp lệ.");
        }}>
          <div className="section-head"><div><h2>Sinh SKU hàng loạt</h2><p className="meta">Màu × cỡ có chủ ý; bỏ qua tổ hợp đã tồn tại, không bịa tồn kho/barcode.</p></div></div>
          <div className="catalog-field"><label htmlFor="gen-colors">Màu (phẩy ngăn cách)</label><input id="gen-colors" className="catalog-input" value={genColors} maxLength={500} onChange={(e) => setGenColors(e.target.value)} placeholder="Đen, Trắng" /></div>
          <div className="catalog-field"><label htmlFor="gen-sizes">Cỡ (phẩy ngăn cách)</label><input id="gen-sizes" className="catalog-input" value={genSizes} maxLength={500} onChange={(e) => setGenSizes(e.target.value)} placeholder="S, M, L" /></div>
          <div className="catalog-actions"><button className="primary" type="submit" disabled={busy}>Xem trước tổ hợp</button></div>
          {genPreview && genPreview.length > 0 ? <div className="table-scroll" tabIndex={0} aria-label="Tổ hợp SKU sẽ thêm"><table className="review-orders-table"><thead><tr><th>Màu</th><th>Cỡ</th></tr></thead><tbody>{genPreview.map((row, i) => <tr key={i}><td>{row.color ?? "—"}</td><td>{row.size ?? "—"}</td></tr>)}</tbody></table>
            <p className="meta">{genPreview.length} tổ hợp mới{genSkipped > 0 ? ` · bỏ qua ${genSkipped} tổ hợp đã tồn tại` : ""}.</p>
            <button className="primary" type="button" disabled={busy} onClick={async () => {
              if (busy) return; setBusy(true); setError("");
              try { for (const row of genPreview) { await createVariant(id, { color: row.color, size: row.size }); } setGenPreview(null); setGenColors(""); setGenSizes(""); await load(); }
              catch (err) { setError(err instanceof Error ? err.message : "Không thêm được SKU hàng loạt."); }
              finally { setBusy(false); }
            }}>{busy ? "Đang thêm…" : `Thêm ${genPreview.length} SKU`}</button></div> : null}
        </form>
      </> : null}
      {barcodeData ? <div className="workbench" role="dialog" aria-label="Mã vạch SKU" style={{ marginTop: 18 }}><h2>Mã vạch</h2><p className="meta">{barcodeData.text ?? "Không có barcode"}</p>{barcodeData.image ? (
        // eslint-disable-next-line @next/next/no-img-element -- barcode PNG data from BE, not an uploaded file
        <img src={barcodeData.image} alt="Mã vạch SKU" style={{ maxWidth: 300 }} />
      ) : null}<button className="text-link" type="button" onClick={() => setBarcodeData(null)}>Đóng</button></div> : null}
    </> : null}</AdminShellB>;
}
function nrole(role: string | null) { return role === "ADMIN" ? "" : " (yêu cầu ADMIN)"; }
