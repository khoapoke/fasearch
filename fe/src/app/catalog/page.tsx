"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { StorefrontShell } from "@/components/storefront/storefront-shell";
import account from "@/components/account/account.module.css";
import mgmt from "@/components/mgmt/mgmt.module.css";
import { beFetch, unwrap, vnd, type Page } from "@/lib/mgmt-client";

type PublicCategory = { maDanhMuc: number; tenDanhMuc: string };
type PublicProduct = {
  maSp: number;
  tenSp: string;
  maDanhMuc: number | null;
  tenDanhMuc: string | null;
  giaBan: number;
  coHinhAnh: boolean;
};

function CatalogInner() {
  const params = useSearchParams();
  const q = params.get("q") ?? "";
  const maDanhMuc = params.get("maDanhMuc") ?? "";
  const page = Number(params.get("page") ?? "0") || 0;
  const [categories, setCategories] = useState<PublicCategory[]>([]);
  const [reloadKey, setReloadKey] = useState(0);
  const viewKey = `${q}|${maDanhMuc}|${page}|${reloadKey}`;
  const [settled, setSettled] = useState<{
    key: string;
    data?: Page<PublicProduct>;
    error?: string;
  }>({ key: "" });
  const data = settled.key === viewKey ? settled.data : undefined;
  const error = settled.key === viewKey ? settled.error : undefined;

  useEffect(() => {
    let live = true;
    beFetch("v1/catalog/danh-muc")
      .then((r) => unwrap<PublicCategory[]>(r))
      .then((cats) => {
        if (live) setCategories(cats);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);

  useEffect(() => {
    let live = true;
    const query = new URLSearchParams();
    if (q) query.set("q", q);
    if (maDanhMuc) query.set("maDanhMuc", maDanhMuc);
    query.set("page", String(page));
    query.set("size", "24");
    beFetch(`v1/catalog/san-pham?${query.toString()}`)
      .then((r) => unwrap<Page<PublicProduct>>(r))
      .then((result) => {
        if (live) setSettled({ key: viewKey, data: result });
      })
      .catch((e: unknown) => {
        if (live) setSettled({ key: viewKey, error: e instanceof Error ? e.message : "Tải thất bại." });
      });
    return () => {
      live = false;
    };
  }, [q, maDanhMuc, page, viewKey]);

  return (
    <main className={account.layout}>
      <p className={account.kicker}>FaSearch</p>
      <h1>Danh mục sản phẩm</h1>
      <p className={account.lede}>Hàng đang bán thật từ hệ thống — không hàng ẩn, không giá nhập. Giao diện danh mục mới: <Link href="/nam">Áo Thun Nam & Polo</Link>.</p>
      <form method="get" className={mgmt.toolbar} aria-label="Lọc sản phẩm">
        <label>
          Tìm theo tên
          <input name="q" defaultValue={q} placeholder="Áo thun…" maxLength={100} />
        </label>
        <label>
          Danh mục
          <select name="maDanhMuc" defaultValue={maDanhMuc}>
            <option value="">Tất cả</option>
            {categories.map((c) => (
              <option key={c.maDanhMuc} value={c.maDanhMuc}>
                {c.tenDanhMuc}
              </option>
            ))}
          </select>
        </label>
        <button className={account.primary} type="submit">
          Lọc
        </button>
      </form>
      {!data && !error && <p className={account.muted}>Đang tải…</p>}
      {error && (
        <section className={account.card} aria-label="Lỗi tải">
          <p className={account.greeting}>Không tải được danh sách</p>
          <p className={account.muted}>{error} Bộ lọc đã giữ nguyên — bấm thử lại.</p>
          <button className={account.primary} type="button" onClick={() => setReloadKey((k) => k + 1)}>
            Thử lại
          </button>
        </section>
      )}
      {data && data.data.length === 0 && (
        <p className={account.muted}>Chưa có sản phẩm nào đang bán phù hợp — thử nới điều kiện tìm.</p>
      )}
      {data && data.data.length > 0 && (
        <>
          <div className={mgmt.cards}>
            {data.data.map((item) => (
              <Link key={item.maSp} className={mgmt.card} href={`/catalog/${item.maSp}`}>
                <span className={mgmt.cardImg}>
                  {item.coHinhAnh ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={`/api/be/v1/catalog/san-pham/${item.maSp}/hinh-anh`}
                      alt={item.tenSp}
                      loading="lazy"
                    />
                  ) : (
                    <span className={mgmt.noImg}>Chưa có ảnh</span>
                  )}
                </span>
                <span className={mgmt.cardBody}>
                  <span className={mgmt.cardTitle}>{item.tenSp}</span>
                  <span className={mgmt.cardPrice}>{vnd(item.giaBan)}</span>
                  <span className={mgmt.cardMeta}>{item.tenDanhMuc ?? "—"}</span>
                </span>
              </Link>
            ))}
          </div>
          <div className={mgmt.pager}>
            <span>
              Trang {data.page + 1}/{Math.max(data.totalPages, 1)} — {data.totalElements} sản phẩm
            </span>
            {page > 0 && (
              <Link
                className={mgmt.linkButton}
                href={`/catalog?${buildQuery(q, maDanhMuc, page - 1)}`}
              >
                Trước
              </Link>
            )}
            {page + 1 < data.totalPages && (
              <Link
                className={mgmt.linkButton}
                href={`/catalog?${buildQuery(q, maDanhMuc, page + 1)}`}
              >
                Sau
              </Link>
            )}
          </div>
        </>
      )}
    </main>
  );
}

function buildQuery(q: string, maDanhMuc: string, page: number): string {
  const query = new URLSearchParams();
  if (q) query.set("q", q);
  if (maDanhMuc) query.set("maDanhMuc", maDanhMuc);
  if (page > 0) query.set("page", String(page));
  return query.toString();
}

export default function CatalogPage() {
  return (
    <StorefrontShell active="/nam" previewNote="Trang Catalog giữ nguyên luồng dữ liệu thật; giao diện danh mục mới nằm ở /nam.">
      <Suspense fallback={<p>Đang tải…</p>}>
        <CatalogInner />
      </Suspense>
    </StorefrontShell>
  );
}
