"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { MgmtShell } from "@/components/mgmt/mgmt-shell";
import account from "@/components/account/account.module.css";
import mgmt from "@/components/mgmt/mgmt.module.css";
import { beFetch, beWrite, unwrap, vnd } from "@/lib/mgmt-client";

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
    <MgmtShell
      title={`Sản phẩm #${id}`}
      lede="Sửa thông tin/giá (đổi giá ghi audit), ảnh thật, ma trận màu×cỡ, mã vạch CODE-128 và tem in."
      need={["ADMIN", "STAFF"]}
    >
      {notice && (
        <p className={account.muted} role="alert">
          {notice}
        </p>
      )}
      {!product && <p className={account.muted}>Đang tải…</p>}
      {product && (
        <>
          <section className={account.card} aria-label="Thông tin sản phẩm">
            <p className={account.greeting}>{product.tenSp}</p>
            <p className={account.muted}>
              {product.tenDanhMuc ?? "—"} · Bán {vnd(product.giaBan)} · Nhập{" "}
              {product.giaNhap === null ? "chưa có" : vnd(product.giaNhap)}
            </p>
            {product.coHinhAnh ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                className={mgmt.detailImg}
                src={`/api/be/v1/san-pham/${id}/hinh-anh?nonce=${imgNonce}`}
                alt={product.tenSp}
              />
            ) : (
              <p className={account.muted}>Chưa có ảnh.</p>
            )}
            <form
              className={mgmt.formGrid}
              onSubmit={(e) => {
                e.preventDefault();
                saveEdit(new FormData(e.currentTarget));
              }}
            >
              <label>
                Tên
                <input name="tenSp" defaultValue={product.tenSp} maxLength={255} />
              </label>
              <label>
                Giá bán (VND)
                <input name="giaBan" defaultValue={String(product.giaBan)} inputMode="decimal" />
              </label>
              <label>
                Giá nhập (VND)
                <input
                  name="giaNhap"
                  defaultValue={product.giaNhap === null ? "" : String(product.giaNhap)}
                  inputMode="decimal"
                  placeholder="Để trống = giữ nguyên"
                />
              </label>
              <label>
                Chất liệu
                <input name="chatLieu" defaultValue={product.chatLieu ?? ""} maxLength={100} />
              </label>
              <label>
                Kiểu dáng
                <input name="kieuDang" defaultValue={product.kieuDang ?? ""} maxLength={100} />
              </label>
              <label className={mgmt.fullRow}>
                Mô tả
                <textarea name="moTa" defaultValue={product.moTa ?? ""} />
              </label>
              <div className={mgmt.fullRow}>
                <button className={account.primary} type="submit">
                  Lưu thay đổi
                </button>
              </div>
            </form>
            <label>
              Đổi ảnh (JPEG/PNG ≤5MB)
              <input
                type="file"
                accept="image/jpeg,image/png"
                onChange={(e) => upload(e.target.files?.[0])}
              />
            </label>
          </section>

          <section className={account.card} aria-label="Biến thể và mã vạch">
            <p className={account.greeting}>Biến thể ({variants.length})</p>
            <form
              className={mgmt.toolbar}
              onSubmit={(e) => {
                e.preventDefault();
                addMatrix(new FormData(e.currentTarget));
              }}
            >
              <label>
                Màu (phân cách dấu phẩy)
                <input name="mauSac" placeholder="Đỏ, Xanh" maxLength={500} />
              </label>
              <label>
                Cỡ (phân cách dấu phẩy)
                <input name="kichCo" placeholder="M, L" maxLength={500} />
              </label>
              <button className={account.secondary} type="submit">
                Sinh ma trận
              </button>
              <a className={mgmt.linkButton} href={`/api/be/v1/san-pham/${id}/bien-the/export`}>
                Xuất CSV
              </a>
              <button
                className={mgmt.linkButton}
                type="button"
                onClick={() => window.print()}
              >
                In tem
              </button>
            </form>
            {variants.length === 0 && (
              <p className={account.muted}>Chưa có biến thể nào.</p>
            )}
            <div className={mgmt.tableWrap + " " + mgmt.noPrint}>
              <table className={mgmt.table}>
                <thead>
                  <tr>
                    <th>SKU</th>
                    <th>Màu / Cỡ</th>
                    <th>Mã vạch</th>
                    <th>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {variants.map((v) => (
                    <tr key={v.maSku}>
                      <td>{v.maSku}</td>
                      <td>
                        {v.mauSac} / {v.kichCo}
                      </td>
                      <td>{v.maVach}</td>
                      <td>
                        <button className={mgmt.linkButton} onClick={() => removeVariant(v)}>
                          Xóa
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {variants.length > 0 && (
              <div className={mgmt.labels + " " + mgmt.printArea}>
                {variants.map((v) => (
                  <div key={v.maSku} className={mgmt.label}>
                    <div>
                      <b>{product.tenSp}</b>
                    </div>
                    <div>
                      {v.mauSac} — {v.kichCo}
                    </div>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={`/api/be/v1/bien-the/${v.maSku}/ma-vach.png`}
                      alt={`Mã vạch ${v.maVach}`}
                    />
                    <div>{v.maVach}</div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </MgmtShell>
  );
}
