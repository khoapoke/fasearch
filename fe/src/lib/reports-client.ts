// Isolated report adapters — revenue/product/XNT (BE CONTRACT v1-READY).
// Response shapes follow generated OpenAPI exactly: {rows|top|..., ghiChuBaoPhu}.
// Không mock trong app; test-only fixtures nằm trong tests/*.test.mjs và có nhãn rõ.

import { beFetch, unwrap } from "./mgmt-client.ts";

export type DoanhThuRow = {
  ngay: string; soDon: number; tongThu: number; giamVoucher: number;
  giamDiem: number; phiVanChuyen: number; vonHangBan: number | null;
  loiGop: number | null; dongThieuVon: number;
};

export type DoanhThuResult = { rows: DoanhThuRow[]; ghiChuBaoPhu?: string | null };

export type SanPhamRow = {
  maSp: number; tenSp: string; soLuongBan: number; doanhThu: number; daXoa?: boolean | null;
};

export type SanPhamResult = {
  top: SanPhamRow[]; banCham: SanPhamRow[]; chuaTungBan: SanPhamRow[];
  ghiChuBaoPhu?: string | null;
};

export type XntRow = {
  maSku: number; maKho: number; tonDau: number; nhap: number; xuat: number;
  dieuChinh: number; tonCuoi: number; tonDauUnknown?: boolean | null;
};

export type XntResult = {
  rows: XntRow[]; skuTonDauUnknown?: number[] | null; ghiChuBaoPhu?: string | null;
};

export async function fetchRevenue(query: string): Promise<DoanhThuResult> {
  const r = await beFetch(`v1/bao-cao/doanh-thu?${query}`);
  return unwrap<DoanhThuResult>(r);
}

export async function fetchProducts(query: string): Promise<SanPhamResult> {
  const r = await beFetch(`v1/bao-cao/san-pham?${query}`);
  return unwrap<SanPhamResult>(r);
}

export async function fetchXnt(query: string): Promise<XntResult> {
  const r = await beFetch(`v1/bao-cao/xuat-nhap-ton?${query}`);
  return unwrap<XntResult>(r);
}

/** Tải CSV qua endpoint /csv cùng filters; BE neutralize formula injection; FE chỉ lưu bytes và tên an toàn. */
export async function downloadReportCsv(kind: "doanh-thu" | "san-pham" | "xuat-nhap-ton", query: string, filename: string): Promise<string> {
  const r = await fetch(`/api/be/v1/bao-cao/${kind}/csv?${query}`, { cache: "no-store" });
  if (!r.ok) {
    let msg = `Tải CSV thất bại (HTTP ${r.status}).`;
    try {
      const p = (await r.json()) as { message?: string };
      if (p.message) msg = p.message;
    } catch {
      /* blob/text */
    }
    const e = new Error(msg) as Error & { status: number };
    e.status = r.status;
    throw e;
  }
  const blob = await r.blob();
  const url = URL.createObjectURL(new Blob([blob], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  return filename;
}
