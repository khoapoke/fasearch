"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import { MerchantShell } from "@/components/merchant/merchant-shell";
import { beFetch, beWrite, unwrap, vnd } from "@/lib/mgmt-client";

const field: React.CSSProperties = { width: "100%", border: "1px solid var(--line)", borderRadius: 10, padding: "10px 12px", marginTop: 4 };

type Product = {
  maSp: number;
  tenSp: string;
  maDanhMuc: number | null;
  tenDanhMuc: string | null;
  chatLieu: string | null;
  kieuDang: string | null;
  moTa: string | null;
  giaBan: number;
  giaNhap: number | null;
  trangThai: string;
  daXoa: boolean;
  coHinhAnh: boolean;
};

type Variant = {
  maSku: number;
  maSp: number;
  mauSac: string;
  kichCo: string;
  maVach: string;
};

export default function ProductDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const [product, setProduct] = useState<Product | null>(null);
  const [variants, setVariants] = useState<Variant[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [imgNonce, setImgNonce] = useState(0);
  const [reloadKey, setReloadKey] = useState(0);

  function reload() {
    setReloadKey((k) => k + 1);
  }

  useEffect(() => {
    let live = true;
    Promise.all([
      beFetch(`v1/san-pham/${id}`).then((r) => unwrap<Product>(r)),
      beFetch(`v1/san-pham/${id}/bien-the`).then((r) => unwrap<Variant[]>(r)),
    ])
      .then(([p, v]) => {
        if (live) {
          setProduct(p);
          setVariants(v);
          setNotice(null);
        }
      })
      .catch((e: unknown) => {
        if (live) setNotice(e instanceof Error ? e.message : "Tải thất bại.");
      });
    return () => {
      live = false;
    };
  }, [id, reloadKey]);

  async function saveEdit(form: FormData) {
    const body: Record<string, unknown> = {};
    const put = (key: string, value: FormDataEntryValue | null, num = false) => {
      if (value === null) return;
      const text = String(value).trim();
      if (text === "") return;
      body[key] = num ? Number(text) : text;
    };
    put("tenSp", form.get("tenSp"));
    put("chatLieu", form.get("chatLieu"));
    put("kieuDang", form.get("kieuDang"));
    put("moTa", form.get("moTa"));
    put("giaBan", form.get("giaBan"), true);
    put("giaNhap", form.get("giaNhap"), true);
    try {
      await unwrap(await beWrite(`v1/san-pham/${id}`, "PATCH", body));
      reload();
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Lưu thất bại.");
    }
  }

  async function upload(file: File | undefined) {
    if (!file) return;
    setNotice(null);
    try {
      const csrf = await fetch("/api/auth/csrf", { cache: "no-store" }).then((r) => r.json());
      const token = csrf.result as { headerName: string; token: string };
      const form = new FormData();
      form.set("file", file);
      const response = await fetch(`/api/be/v1/san-pham/${id}/hinh-anh`, {
        method: "POST",
        headers: { [token.headerName]: token.token },
        body: form,
        cache: "no-store",
      });
      await unwrap(response);
      setImgNonce((n) => n + 1);
      reload();
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Tải ảnh thất bại.");
    }
  }

  async function addMatrix(form: FormData) {
    const colors = String(form.get("mauSac") ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const sizes = String(form.get("kichCo") ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    try {
      await unwrap(
        await beWrite(`v1/san-pham/${id}/bien-the/ma-tran`, "POST", {
          mauSac: colors,
          kichCo: sizes,
        }),
      );
      reload();
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Tạo ma trận thất bại.");
    }
  }

  async function removeVariant(v: Variant) {
    if (!window.confirm(`Xóa biến thể ${v.mauSac}/${v.kichCo} (${v.maVach})?`)) return;
    try {
      await unwrap(await beWrite(`v1/bien-the/${v.maSku}`, "DELETE"));
      reload();
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Xóa thất bại (còn giao dịch tham chiếu → 409).");
    }
  }

  return (
    <MerchantShell active="products">
      <div className="mpCard">
        <nav className="pgCrumbs" aria-label="Đường dẫn">
          <Link href="/quan-tri/san-pham">Sản phẩm</Link><span aria-hidden="true">›</span>
          <span aria-current="page">Sản phẩm #{id}</span>
        </nav>
        <h2>Sản phẩm #{id}</h2>
        <p className="mpMuted">Sửa thông tin/giá (đổi giá ghi audit), ảnh thật, ma trận màu×cỡ, mã vạch CODE-128 và tem in.</p>
      {notice && (
        <p className="mpMuted" role="alert" style={{ color: "#ba1a1a" }}>
          {notice}
        </p>
      )}
      </div>
      {!product && <p className="mpMuted" role="status">Đang tải…</p>}
      {product && (
        <>
          <div className="mpCard" aria-label="Thông tin sản phẩm">
            <h2>{product.tenSp}</h2>
            <p className="mpMuted">
              {product.tenDanhMuc ?? "—"} · Bán {vnd(product.giaBan)} · Nhập{" "}
              {product.giaNhap === null ? "chưa có" : vnd(product.giaNhap)}
            </p>
            {product.coHinhAnh ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                style={{ width: 220, borderRadius: 12, display: "block", margin: "10px 0" }}
                src={`/api/be/v1/san-pham/${id}/hinh-anh?nonce=${imgNonce}`}
                alt={product.tenSp}
              />
            ) : (
              <p className="mpMuted">Chưa có ảnh.</p>
            )}
            <form
              style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 10 }}
              onSubmit={(e) => {
                e.preventDefault();
                saveEdit(new FormData(e.currentTarget));
              }}
            >
              <label>
                Tên
                <input name="tenSp" defaultValue={product.tenSp} maxLength={255} style={field} />
              </label>
              <label>
                Giá bán (VND)
                <input name="giaBan" defaultValue={String(product.giaBan)} inputMode="decimal" style={field} />
              </label>
              <label>
                Giá nhập (VND)
                <input
                  name="giaNhap"
                  defaultValue={product.giaNhap === null ? "" : String(product.giaNhap)}
                  inputMode="decimal"
                  placeholder="Để trống = giữ nguyên"
                  style={field}
                />
              </label>
              <label>
                Chất liệu
                <input name="chatLieu" defaultValue={product.chatLieu ?? ""} maxLength={100} style={field} />
              </label>
              <label>
                Kiểu dáng
                <input name="kieuDang" defaultValue={product.kieuDang ?? ""} maxLength={100} style={field} />
              </label>
              <label style={{ gridColumn: "1/-1" }}>
                Mô tả
                <textarea name="moTa" defaultValue={product.moTa ?? ""} style={field} />
              </label>
              <div style={{ gridColumn: "1/-1" }}>
                <button className="mpTopBtn primary" type="submit">
                  Lưu thay đổi
                </button>
              </div>
            </form>
            <label style={{ display: "block", marginTop: 10 }}>
              Đổi ảnh (JPEG/PNG ≤5MB)
              <input
                type="file"
                accept="image/jpeg,image/png"
                onChange={(e) => upload(e.target.files?.[0])}
                style={{ maxWidth: "100%", width: "100%" }}
              />
            </label>
          </div>

          <div className="mpCard" aria-label="Biến thể và mã vạch">
            <h2>Biến thể ({variants.length})</h2>
            <form
              style={{ display: "flex", gap: 10, flexWrap: "wrap", margin: "10px 0" }}
              onSubmit={(e) => {
                e.preventDefault();
                addMatrix(new FormData(e.currentTarget));
              }}
            >
              <input name="mauSac" placeholder="Màu (phân cách dấu phẩy)" maxLength={500} aria-label="Màu" style={{ border: "1px solid var(--line)", borderRadius: 10, padding: "10px 12px" }} />
              <input name="kichCo" placeholder="Cỡ (phân cách dấu phẩy)" maxLength={500} aria-label="Cỡ" style={{ border: "1px solid var(--line)", borderRadius: 10, padding: "10px 12px" }} />
              <button className="mpTopBtn" type="submit">
                Sinh ma trận
              </button>
              <a className="mpTopBtn" href={`/api/be/v1/san-pham/${id}/bien-the/export`}>
                Xuất CSV
              </a>
              <button
                className="mpTopBtn"
                type="button"
                onClick={() => window.print()}
              >
                In tem
              </button>
            </form>
            {variants.length === 0 && (
              <p className="mpMuted">Chưa có biến thể nào.</p>
            )}
            <div className="mpTableWrap">
              <table className="mpTable">
                <thead>
                  <tr>
                    <th>SKU</th>
                    <th>Màu / Cỡ</th>
                    <th>Mã vạch</th>
                    <th style={{ textAlign: "right" }}>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {variants.map((v) => (
                    <tr key={v.maSku}>
                      <td>{v.maSku}</td>
                      <td>
                        {v.mauSac} / {v.kichCo}
                      </td>
                      <td style={{ fontFamily: "monospace" }}>{v.maVach}</td>
                      <td style={{ textAlign: "right" }}>
                        <button className="mpTopBtn" style={{ padding: "7px 12px", fontSize: 12.5 }} onClick={() => removeVariant(v)}>
                          Xóa
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {variants.length > 0 && (
              <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginTop: 14 }}>
                {variants.map((v) => (
                  <div key={v.maSku} style={{ border: "1px dashed var(--line)", borderRadius: 10, padding: 12, textAlign: "center", width: 220 }}>
                    <div>
                      <b>{product.tenSp}</b>
                    </div>
                    <div className="mpMuted">
                      {v.mauSac} — {v.kichCo}
                    </div>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={`/api/be/v1/bien-the/${v.maSku}/ma-vach.png`}
                      alt={`Mã vạch ${v.maVach}`}
                      style={{ width: 180, marginTop: 6 }}
                    />
                    <div className="mpMuted" style={{ fontFamily: "monospace" }}>{v.maVach}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </MerchantShell>
  );
}
