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

const TEST_FIXTURE_LOYALTY = {
  __testFixture: true, customerId: 1, balancePoints: 120, heldPoints: 20, availablePoints: 100,
  cumulativePaidSales: 1500000, salesTierId: 2, salesTierName: "Bạc", salesTierStatus: "KNOWN",
  openingRecorded: true, policyStatus: "ENABLED", currentPolicyId: 7, currentPolicyVersion: 2,
};

const TEST_FIXTURE_HISTORY_PAGE = {
  __testFixture: true,
  content: [{ entryId: 1, type: "EARN", points: 120, orderId: 9, occurredAt: "2026-10-18T00:00:00" }],
  pageNumber: 0, pageSize: 20, totalElements: 1, totalPages: 1, last: true,
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

  it("own loyalty maps the exact contract balance without replacing unknown values", async () => {
    const { fetchOwnLoyalty } = await import("../src/lib/benefits-client.ts");
    fixtures.set("GET /api/customer-commerce/loyalty", jsonResponse(200, envelope(TEST_FIXTURE_LOYALTY)));
    const me = await fetchOwnLoyalty();
    assert.equal(me.customerId, 1);
    assert.equal(me.balance.availablePoints, 100);
    assert.equal(me.balance.cumulativePaidSales, 1500000);
    assert.equal(me.balance.policyStatus, "ENABLED");
  });

  it("own loyalty preserves null opening/history coverage rather than converting them to zero", async () => {
    const { fetchOwnLoyalty } = await import("../src/lib/benefits-client.ts");
    fixtures.set("GET /api/customer-commerce/loyalty", jsonResponse(200, envelope({ ...TEST_FIXTURE_LOYALTY, availablePoints: null, cumulativePaidSales: null, salesTierId: null, salesTierName: null, salesTierStatus: "HISTORY_UNKNOWN", openingRecorded: false, policyStatus: "UNCONFIGURED", currentPolicyId: null, currentPolicyVersion: null })));
    const me = await fetchOwnLoyalty();
    assert.equal(me.balance.availablePoints, null);
    assert.equal(me.balance.cumulativePaidSales, null);
    assert.equal(me.balance.salesTierStatus, "HISTORY_UNKNOWN");
  });

  it("history maps ledger entries using the current PageResponse wire names", async () => {
    const { fetchOwnLoyaltyHistory } = await import("../src/lib/benefits-client.ts");
    fixtures.set("GET /api/customer-commerce/loyalty/history", jsonResponse(200, envelope(TEST_FIXTURE_HISTORY_PAGE)));
    const pg = await fetchOwnLoyaltyHistory("page=0&size=20");
    assert.deepEqual(pg.data, [{ entryId: 1, type: "EARN", points: 120, orderId: 9, occurredAt: "2026-10-18T00:00:00" }]);
  });

  it("empty history remains an empty successful page", async () => {
    const { fetchOwnLoyaltyHistory } = await import("../src/lib/benefits-client.ts");
    fixtures.set("GET /api/customer-commerce/loyalty/history", jsonResponse(200, envelope({ content: [], pageNumber: 0, pageSize: 20, totalElements: 0, totalPages: 0, last: true })));
    assert.deepEqual((await fetchOwnLoyaltyHistory("page=0&size=20")).data, []);
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

  it("policy PUT sends the contract version and full new money/status values", async () => {
    const { updateLoyaltyPolicy } = await import("../src/lib/benefits-client.ts");
    fixtures.set("PUT /api/admin/loyalty/policies/3", jsonResponse(200, envelope({ policyId: 3, version: 4, earnCurrencyPerPoint: 50000, redeemCurrencyPerPoint: 1000, status: "ENABLED", createdAt: "2026-10-18T00:00:00" })));
    const p = await updateLoyaltyPolicy(3, { version: 3, earnCurrencyPerPoint: 50000, redeemCurrencyPerPoint: 1000, status: "ENABLED" });
    assert.equal(p.status, "ENABLED");
    const put = calls.find((x) => x.method === "PUT");
    assert.match(put.body, /"version":3/);
    assert.match(put.body, /"earnCurrencyPerPoint":50000/);
    assert.match(put.body, /"redeemCurrencyPerPoint":1000/);
    assert.match(put.body, /"status":"ENABLED"/);
  });

  it("policy GET accepts an empty successful PageResponse but does not swallow endpoint errors", async () => {
    const { fetchLoyaltyPolicy } = await import("../src/lib/benefits-client.ts");
    fixtures.set("GET /api/admin/loyalty/policies", jsonResponse(200, envelope({ content: [], pageNumber: 0, pageSize: 20, totalElements: 0, totalPages: 0, last: true })));
    assert.deepEqual(await fetchLoyaltyPolicy(), []);
    fixtures.set("GET /api/admin/loyalty/policies", jsonResponse(404, { success: false, code: 404, message: "missing", result: null }));
    await assert.rejects(fetchLoyaltyPolicy(), /missing/);
  });
  it("tier update sends optimistic version and currency threshold", async () => {
    const { updateTierThreshold } = await import("../src/lib/benefits-client.ts");
    fixtures.set("PUT /api/admin/loyalty/tiers/2", jsonResponse(200, envelope({ tierId: 2, name: "Bạc", minimumCumulativePaidSales: 5000000, version: 2 })));
    await updateTierThreshold(2, 1, 5000000);
    const put = calls.find((x) => x.method === "PUT" && x.url.includes("/tiers/2"));
    assert.ok(put);
    assert.match(put.body, /"version":1/);
    assert.match(put.body, /"minimumCumulativePaidSales":5000000/);
  });

  it("tier discovery uses contract-native ids and field names", async () => {
    const { fetchTierList } = await import("../src/lib/benefits-client.ts");
    fixtures.set("GET /api/admin/loyalty/tiers", jsonResponse(200, envelope([
      { tierId: 1, name: "Đồng", minimumCumulativePaidSales: null, version: 1 },
      { tierId: 2, name: "Bạc", minimumCumulativePaidSales: 2500000, version: 4 },
    ])));
    const tiers = await fetchTierList();
    assert.equal(tiers.length, 2);
    assert.equal(tiers[0].name, "Đồng");
    assert.equal(tiers[1].tierId, 2);
  });

  it("opening writes the exact customerId field", async () => {
    const { openLegacyBalance } = await import("../src/lib/benefits-client.ts");
    fixtures.set("POST /api/admin/loyalty/opening", jsonResponse(200, envelope({ customerId: 5, openingRecorded: true, openingPoints: 120, entryId: 9, occurredAt: "2026-10-18T00:00:00" })));
    await openLegacyBalance(5);
    assert.match(calls.find((x) => x.method === "POST").body, /"customerId":5/);
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
