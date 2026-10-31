import assert from "node:assert/strict";
import test from "node:test";
import { fetchCampaigns, normalizeCampaign } from "../src/lib/promotions-client.ts";

const campaign = {
  maKm: 3, tenCtkm: "Mùa mới", loaiGiam: "PHAN_TRAM", giaTriGiam: 10,
  ngayBatDau: "2026-10-30T00:00:00", ngayKetThuc: "2026-11-30T23:59:59",
  dieuKienApDung: null, trangThai: "TAM_DUNG", phienBan: 2, maSpApDung: [1, 4],
  codes: [{ maVoucher: 8, maKm: 3, maCode: "SAVE10", soLuongPhatHanh: 10, daSuDung: 2, soLuongGiuCho: 1, trangThai: "ACTIVE" }],
};

async function withFetch(result, run) {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => Response.json({ success: true, result });
  try {
    return await run();
  } finally {
    globalThis.fetch = originalFetch;
  }
}

test("campaign response normalization preserves server-owned code usage", () => {
  assert.deepEqual(normalizeCampaign(campaign), campaign);
  assert.deepEqual(normalizeCampaign({ ...campaign, codes: [] }).codes, []);
});

test("campaign detail requires the exact code/usage snapshot rather than inventing defaults", () => {
  assert.throws(() => normalizeCampaign({ ...campaign, codes: undefined }), /đúng định dạng/);
  assert.throws(() => normalizeCampaign({ ...campaign, codes: [{ ...campaign.codes[0], soLuongGiuCho: undefined }] }), /đúng định dạng/);
});

test("campaign list parses the actual PageResponse last key into internal isLast", async () => {
  const wirePage = { content: [campaign], pageNumber: 0, pageSize: 10, totalElements: 1, totalPages: 1, last: true };
  const page = await withFetch(wirePage, () => fetchCampaigns("page=0&size=10"));
  assert.deepEqual(page, { data: [campaign], page: 0, size: 10, totalElements: 1, totalPages: 1, isLast: true });
});

test("campaign list rejects a missing wire last boolean instead of defaulting or accepting isLast", async () => {
  const wirePage = { content: [campaign], pageNumber: 0, pageSize: 10, totalElements: 1, totalPages: 1, isLast: true };
  await withFetch(wirePage, async () => {
    await assert.rejects(fetchCampaigns("page=0&size=10"), (error) => error.code === "INVALID_RESPONSE");
  });
});
