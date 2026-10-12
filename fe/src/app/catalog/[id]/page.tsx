"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { SiteFooter } from "@/components/stitch-search/site-footer";
import { SiteHeader } from "@/components/stitch-search/site-header";
import account from "@/components/account/account.module.css";
import mgmt from "@/components/mgmt/mgmt.module.css";
import { beFetch, unwrap, vnd } from "@/lib/mgmt-client";

type PublicDetail = {
  maSp: number;
  tenSp: string;
  tenDanhMuc: string | null;
  chatLieu: string | null;
  kieuDang: string | null;
  moTa: string | null;
  giaBan: number;
  coHinhAnh: boolean;
  bienThe: Array<{ mauSac: string; kichCo: string }>;
};

export default function CatalogDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const [data, setData] = useState<PublicDetail | null>(null);
  const [missing, setMissing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    beFetch(`v1/catalog/san-pham/${id}`)
      .then((r) => {
        if (r.status === 404) {
          if (live) setMissing(true);
          return null;
        }
        return unwrap<PublicDetail>(r);
      })
      .then((result) => {
        if (live && result) setData(result);
      })
      .catch((e: Error) => {
        if (live) setError(e.message);
      });
    return () => {
      live = false;
    };
  }, [id]);

  return (
    <div>
      <SiteHeader />
      <main className={account.layout}>
        <p className={account.crumbs}>
          <Link href="/catalog">Catalog</Link> / <span>Chi tiết</span>
        </p>
        {!data && !missing && !error && <p className={account.muted}>Đang tải…</p>}
        {missing && (
          <section className={account.card} aria-label="Không tồn tại">
            <p className={account.greeting}>Sản phẩm không tồn tại hoặc đã ngừng bán</p>
            <p className={account.muted}>
              <Link href="/catalog">Về danh mục</Link>
            </p>
          </section>
        )}
        {error && <p className={account.muted}>{error}</p>}
        {data && (
          <>
            <h1>{data.tenSp}</h1>
            <p className={account.lede}>{data.tenDanhMuc ?? "—"}</p>
            {data.coHinhAnh ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                className={mgmt.detailImg}
                src={`/api/be/v1/catalog/san-pham/${data.maSp}/hinh-anh`}
                alt={data.tenSp}
              />
            ) : (
              <p className={account.muted}>Chưa có ảnh.</p>
            )}
            <p style={{ fontSize: 22, fontWeight: 700 }}>{vnd(data.giaBan)}</p>
            <section className={account.card} aria-label="Thông tin">
              {data.chatLieu && (
                <p>
                  <b>Chất liệu:</b> {data.chatLieu}
                </p>
              )}
              {data.kieuDang && (
                <p>
                  <b>Kiểu dáng:</b> {data.kieuDang}
                </p>
              )}
              {data.moTa && <p>{data.moTa}</p>}
            </section>
            {data.bienThe.length > 0 && (
              <section className={account.card} aria-label="Màu và cỡ">
                <p className={account.greeting}>Màu / cỡ hiện có</p>
                <div className={mgmt.chips}>
                  {data.bienThe.map((v, i) => (
                    <span key={i} className={mgmt.chip}>
                      {v.mauSac} — {v.kichCo}
                    </span>
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
