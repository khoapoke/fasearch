import assert from "node:assert/strict";
import test from "node:test";
import { campaignBody, codeBody } from "../src/lib/server/promotions-validation.ts";

const campaign = {
  tenCtkm: "  Giảm hè  ", loaiGiam: "PHAN_TRAM", giaTriGiam: 10,
  ngayBatDau: "2026-10-31T00:00:00", ngayKetThuc: "2026-11-30T23:59:59",
  maSpApDung: [7, 9],
};

test("campaign validation preserves HCM wall time and whitelists the contract DTO", () => {
  assert.deepEqual(campaignBody({ ...campaign, admin: true, phienBan: 45 }, true), {
    tenCtkm: "Giảm hè", loaiGiam: "PHAN_TRAM", giaTriGiam: 10,
    ngayBatDau: campaign.ngayBatDau, ngayKetThuc: campaign.ngayKetThuc, maSpApDung: [7, 9],
  });
  assert.equal(campaignBody({ ...campaign, ngayBatDau: "2026-10-31T00:00:00Z" }, true), null);
  assert.equal(campaignBody({ ...campaign, giaTriGiam: 101 }, true), null);
  assert.deepEqual(campaignBody({ phienBan: 2, trangThai: "TAM_DUNG" }, false), { phienBan: 2, trangThai: "TAM_DUNG" });
  assert.equal(campaignBody({ trangThai: "TAM_DUNG" }, false), null);
});

test("code issuance validates Java-character limit and nullable positive quota", () => {
  assert.deepEqual(codeBody({ maCode: " summer10 ", soLuongPhatHanh: null }), { maCode: "SUMMER10", soLuongPhatHanh: null });
  assert.equal(codeBody({ maCode: "x".repeat(51), soLuongPhatHanh: 1 }), null);
  assert.equal(codeBody({ maCode: "VALID", soLuongPhatHanh: 0 }), null);
  assert.equal(codeBody({ maCode: "VALID" }), null);
});
