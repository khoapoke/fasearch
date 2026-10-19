// Contract-shape tests cho benefits/reports adapters (BE CONTRACT PROPOSED revision 1).
// Test-only fixtures CÓ NHÃN — chỉ kiểm tra path/method/envelope mapping của adapter,
// KHÔNG phải bằng chứng endpoint thật. Endpoint thật do BE freeze trong live/be/CONTRACT.json.
// Run: node --test tests/benefits-contract.test.mjs (from fe/)

import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";

const calls = [];
const fixtures = new Map();

function jsonResponse(status, payload) {
  return new Response(JSON.stringify(payload), { status, headers: { "content-type": "application/json" } });
}

function envelope(result) {
  return { success: true, code: 200, message: "ok", result };
}

const TEST_FIXTURE_OFFER = {
  __testFixture: true, maKm: 1, tenCtkm: "Khai trương", loaiGiam: "PHAN_TRAM",
  giaTriGiam: 10, ngayKetThuc: "2026-11-18T00:00:00", conLai: 99,
};

const TEST_FIXTURE_LOYALTY_FLAT = {
  __testFixture: true,
  maKh: 1, soDu: 120, khaDung: 100, dangGiu: 20,
  tongChiTieu: 1500000, tenHang: "Bạc", daMoDau: true,
};

const TEST_FIXTURE_HISTORY_PAGE = {
  __testFixture: true,
  data: [{ maGd: 1, loai: "TICH", soDiem: 120, maDonHang: 9, thoiGian: "2026-10-18T00:00:00" }],
  page: 0, size: 20, totalElements: 1, totalPages: 1,
};

let realFetch;
beforeEach(() => {
  realFetch = globalThis.fetch;
  calls.length = 0;
  fixtures.clear();
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), method: init?.method ?? "GET", body: init?.body });
    if (String(url).endsWith("/api/auth/csrf")) {
      return jsonResponse(200, { success: true, code: 200, message: "ok", result: { headerName: "X-CSRF-TOKEN", token: "test-csrf" } });
    }
    const key = `${init?.method ?? "GET"} ${String(url).split("?")[0]}`;
    if (fixtures.has(key)) return fixtures.get(key);
    return jsonResponse(404, { success: false, code: 404, message: "no fixture", result: null });
  };
});

afterEach(() => {
  globalThis.fetch = realFetch;
});

describe("benefits adapters hit contract paths with envelope", () => {
  it("published offers GET v1/khuyen-mai/dang-mo", async () => {
    const { fetchPublishedOffers } = await import("../src/lib/benefits-client.ts");
    fixtures.set("GET /api/be/v1/khuyen-mai/dang-mo", jsonResponse(200, envelope([TEST_FIXTURE_OFFER])));
    const offers = await fetchPublishedOffers();
    assert.equal(offers[0].tenCtkm, "Khai trương");
    assert.equal(calls[0].method, "GET");
  });

  it("own loyalty flat shape maps to balance (red-capable: no .balance crash)", async () => {
    const { fetchOwnLoyalty } = await import("../src/lib/benefits-client.ts");
    fixtures.set("GET /api/be/v1/thanh-vien", jsonResponse(200, envelope(TEST_FIXTURE_LOYALTY_FLAT)));
    const me = await fetchOwnLoyalty();
    assert.equal(me.maKh, 1);
    assert.equal(me.balance.khaDung, 100);
    assert.equal(me.balance.soDu, 120);
    assert.equal(me.balance.dangGiu, 20);
    assert.equal(me.balance.tongChiTieu, 1500000);
    assert.equal(me.balance.tierName, "Bạc");
    assert.equal(me.balance.daMoDau, true);
  });

  it("history maps ledger maGd/soDiem (no moTa assumption)", async () => {
    const { fetchOwnLoyaltyHistory } = await import("../src/lib/benefits-client.ts");
    fixtures.set("GET /api/be/v1/thanh-vien/lich-su", jsonResponse(200, envelope(TEST_FIXTURE_HISTORY_PAGE)));
    const pg = await fetchOwnLoyaltyHistory("page=0&size=20");
    assert.deepEqual(pg.data, [{ id: 1, loai: "TICH", diem: 120, thoiGian: "2026-10-18T00:00:00", maDonHang: 9 }]);
  });

  it("history GET v1/thanh-vien/lich-su with paging", async () => {
    const { fetchOwnLoyaltyHistory } = await import("../src/lib/benefits-client.ts");
    fixtures.set("GET /api/be/v1/thanh-vien/lich-su", jsonResponse(200, envelope({ data: [], page: 0, size: 20, totalElements: 0, totalPages: 0 })));
    const pg = await fetchOwnLoyaltyHistory("page=0&size=20");
    assert.deepEqual(pg.data, []);
  });

  it("campaign PUT {phienBan, trangThai} (+field edit uses same shape)", async () => {
    const { updateCampaign } = await import("../src/lib/benefits-client.ts");
    fixtures.set("PUT /api/be/v1/khuyen-mai/1", jsonResponse(200, envelope({ maKm: 1, trangThai: "TAM_DUNG", phienBan: 2 })));
    const c = await updateCampaign(1, { phienBan: 1, trangThai: "TAM_DUNG" });
    assert.equal(c.trangThai, "TAM_DUNG");
    const put = calls.find((x) => x.method === "PUT");
    assert.ok(put);
    assert.match(put.body, /"trangThai":"TAM_DUNG"/);
    assert.match(put.body, /"phienBan":1/);
  });

  it("campaign codes POST {maCode, soLuongPhatHanh}", async () => {
    const { addCampaignCode } = await import("../src/lib/benefits-client.ts");
    fixtures.set("POST /api/be/v1/khuyen-mai/1/codes", jsonResponse(200, envelope({ maKm: 1 })));
    await addCampaignCode(1, { maCode: "TEST10", soLuongPhatHanh: null });
    const post = calls.find((x) => x.method === "POST" && x.url.includes("/codes"));
    assert.ok(post);
    assert.match(post.body, /"maCode":"TEST10"/);
  });

  it("policy PUT {phienBan, tyLeTich, giaTriDiem, trangThai}", async () => {
    const { updateLoyaltyPolicy } = await import("../src/lib/benefits-client.ts");
    fixtures.set("PUT /api/be/v1/thanh-vien/chinh-sach/3", jsonResponse(200, envelope({ maChinhSach: 3, tyLeTich: 50000, giaTriDiem: 1000, trangThai: "BAT", phienBan: 4 })));
    const p = await updateLoyaltyPolicy(3, { phienBan: 3, tyLeTich: 50000, giaTriDiem: 1000, trangThai: "BAT" });
    assert.equal(p.trangThai, "BAT");
    assert.equal(p.maChinhSach, 3);
  });

  it("policy 404 -> [] (create flow)", async () => {
    const { fetchLoyaltyPolicy } = await import("../src/lib/benefits-client.ts");
    fixtures.set("GET /api/be/v1/thanh-vien/chinh-sach", jsonResponse(404, { success: false, code: 404, message: "none", result: null }));
    assert.deepEqual(await fetchLoyaltyPolicy(), []);
  });
  it("tier PUT sends {nguongDoanhSo} (cumulative-money per OpenAPI HangUpdateRequest)", async () => {    const { updateTierThreshold } = await import("../src/lib/benefits-client.ts");
    fixtures.set("PUT /api/be/v1/thanh-vien/chinh-sach/hang/2", jsonResponse(200, envelope({ maHang: 2 })));
    await updateTierThreshold(2, 5000000);
    const put = calls.find((x) => x.method === "PUT" && x.url.includes("/hang/2"));
    assert.ok(put);
    assert.match(put.body, /"nguongDoanhSo":5000000/);
    assert.doesNotMatch(put.body, /"nguong"[^D]/);
  });

  it("tier list GET v1/thanh-vien/chinh-sach/hang (BE v2 discovery, no blind IDs)", async () => {
    const { fetchTierList } = await import("../src/lib/benefits-client.ts");
    fixtures.set("GET /api/be/v1/thanh-vien/chinh-sach/hang", jsonResponse(200, envelope([
      { maHang: 1, tenHang: "Đồng", nguongDiem: 0, nguongDoanhSo: null, quyenLoi: "Không có đặc quyền" },
      { maHang: 2, tenHang: "Bạc", nguongDiem: 1000, nguongDoanhSo: null, quyenLoi: "Giảm 5%" },
    ])));
    const tiers = await fetchTierList();
    assert.equal(tiers.length, 2);
    assert.equal(tiers[0].tenHang, "Đồng");
    assert.equal(tiers[1].maHang, 2);
  });
});

describe("benefit submit pins applied inputs + policy snapshot (R2F1: no quote echo)", () => {
  it("checkout submit sends applied voucher/points + policy version, not quote-echoed fields", async () => {
    const { createOnlineOrder } = await import("../src/lib/commerce-client.ts");
    fixtures.set("POST /api/be/v1/don-hang", jsonResponse(201, envelope({ maDonHang: 99, phienBan: 1 })));
    // Quote BE không echo voucherCode/diemSuDung — page phải gửi giá trị đã áp dụng.
    const appliedVoucher = "FEE2E10";
    const appliedPoints = 2;
    const { order } = await createOnlineOrder({
      khoaTam: "op-test", maKho: 1, phienBanGio: 7, tongThanhToanDuKien: 133000,
      nguoiNhan: "Test", sdtNhan: "0901234567", diaChiGiao: "HCM",
      voucherCode: appliedVoucher, diemSuDung: appliedPoints,
      maChinhSach: 4, phienBanChinhSach: 1,
    });
    assert.equal(order.maDonHang, 99);
    const post = calls.find((x) => x.method === "POST" && x.url.includes("/v1/don-hang"));
    assert.ok(post);
    assert.match(post.body, /"voucherCode":"FEE2E10"/);
    assert.match(post.body, /"diemSuDung":2/);
    assert.match(post.body, /"maChinhSach":4/);
    assert.match(post.body, /"phienBanChinhSach":1/);
    assert.match(post.body, /"tongThanhToanDuKien":133000/);
  });

  it("POS pay sends applied voucher/points + policy version", async () => {
    const { posPay } = await import("../src/lib/commerce-client.ts");
    fixtures.set("POST /api/be/v1/pos/don-hang/15/thanh-toan", jsonResponse(200, envelope({
      maDonHang: 15, maHoaDon: 9, tienThua: 19000, items: [{ maSku: 2, soLuong: 1 }],
    })));
    const receipt = await posPay(15, {
      khoaTam: "op-pos", phienBan: 3, tongThanhToanDuKien: 131000, tienKhachDua: 150000,
      voucherCode: "FEE2E10", diemSuDung: 4, maChinhSach: 4, phienBanChinhSach: 1,
    });
    assert.equal(receipt.maHoaDon, 9);
    const post = calls.find((x) => x.method === "POST" && x.url.includes("/thanh-toan"));
    assert.ok(post);
    assert.match(post.body, /"voucherCode":"FEE2E10"/);
    assert.match(post.body, /"diemSuDung":4/);
    assert.match(post.body, /"maChinhSach":4/);
  });
});
describe("pos customer lookup maps array shape (red-capable: no undefined hoTen)", () => {
  it("array result -> first entry with maKh from id", async () => {
    const { posFindCustomer } = await import("../src/lib/commerce-client.ts");
    fixtures.set("GET /api/be/v1/pos/khach-hang", jsonResponse(200, envelope([
      { id: 1, hoTen: "Lê Khách Hàng", sdt: "0922222222", diemTichLuy: 10, diemGiuCho: null, tongChiTieu: null, tenHang: "Đồng" },
    ])));
    const c = await posFindCustomer("0922222222");
    assert.equal(c.maKh, 1);
    assert.equal(c.hoTen, "Lê Khách Hàng");
    assert.equal(c.tenHang, "Đồng");
  });

  it("empty array -> null (walk-in honesty)", async () => {
    const { posFindCustomer } = await import("../src/lib/commerce-client.ts");
    fixtures.set("GET /api/be/v1/pos/khach-hang", jsonResponse(200, envelope([])));
    assert.equal(await posFindCustomer("0900000000"), null);
  });
});

describe("reports adapters", () => {
  it("revenue GET rows + coverage note (no invented summaries)", async () => {
    const { fetchRevenue } = await import("../src/lib/reports-client.ts");
    fixtures.set("GET /api/be/v1/bao-cao/doanh-thu", jsonResponse(200, envelope({ rows: [], ghiChuBaoPhu: "n" })));
    const r = await fetchRevenue("tuNgay=2026-10-01&denNgay=2026-10-18");
    assert.deepEqual(r.rows, []);
    assert.equal(r.ghiChuBaoPhu, "n");
    assert.ok(calls[0].url.includes("tuNgay=2026-10-01"));
  });

  it("san-pham top/banCham/chuaTungBan + xnt unknown-opening flag", async () => {
    const { fetchProducts, fetchXnt } = await import("../src/lib/reports-client.ts");
    fixtures.set("GET /api/be/v1/bao-cao/san-pham", jsonResponse(200, envelope({ top: [], banCham: [], chuaTungBan: [], ghiChuBaoPhu: "g" })));
    fixtures.set("GET /api/be/v1/bao-cao/xuat-nhap-ton", jsonResponse(200, envelope({ rows: [{ maSku: 1, maKho: 1, tonDau: 0, nhap: 5, xuat: 2, dieuChinh: 0, tonCuoi: 3, tonDauUnknown: true }], skuTonDauUnknown: [1], ghiChuBaoPhu: "x" })));
    const sp = await fetchProducts("topN=10");
    assert.deepEqual(sp.top, []);
    const x = await fetchXnt("maKho=1");
    assert.equal(x.rows[0].tonCuoi, 3);
    assert.deepEqual(x.skuTonDauUnknown, [1]);
  });
});
