import assert from "node:assert/strict";
import test from "node:test";
import { normalizeCampaign } from "../src/lib/promotions-client.ts";

const campaign = {
  maKm: 3, tenCtkm: "Mùa mới", loaiGiam: "PHAN_TRAM", giaTriGiam: 10,
  ngayBatDau: "2026-10-30T00:00:00", ngayKetThuc: "2026-11-30T23:59:59",
  dieuKienApDung: null, trangThai: "TAM_DUNG", phienBan: 2, maSpApDung: [1, 4],
  codes: [{ maVoucher: 8, maKm: 3, maCode: "SAVE10", soLuongPhatHanh: 10, daSuDung: 2, soLuongGiuCho: 1, trangThai: "ACTIVE" }],
};

test("campaign response normalization preserves server-owned code usage", () => {
  assert.deepEqual(normalizeCampaign(campaign), campaign);
  assert.deepEqual(normalizeCampaign({ ...campaign, codes: [] }).codes, []);
});

test("campaign detail requires the exact code/usage snapshot rather than inventing defaults", () => {
  assert.throws(() => normalizeCampaign({ ...campaign, codes: undefined }), /đúng định dạng/);
  assert.throws(() => normalizeCampaign({ ...campaign, codes: [{ ...campaign.codes[0], soLuongGiuCho: undefined }] }), /đúng định dạng/);
});
