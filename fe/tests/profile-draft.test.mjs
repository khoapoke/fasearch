// Profile draft keeps original ho/ten fields from the backend DTO.
// Run: node --test tests/profile-draft.test.mjs   (from the fe/ directory)

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { EMPTY_DRAFT, draftFromCustomer } from "../src/lib/profile-draft.ts";

describe("draftFromCustomer", () => {
  it("keeps a one-word given name intact (no doubling)", () => {
    const draft = draftFromCustomer({
      ho: null,
      ten: "Bình",
      gioiTinh: null,
      ngaySinh: null,
      diaChi: null,
      email: null,
    });
    assert.equal(draft.ho, "");
    assert.equal(draft.ten, "Bình");
  });

  it("keeps multi-word name boundaries intact", () => {
    const draft = draftFromCustomer({
      ho: "Trần Minh",
      ten: "Anh",
      gioiTinh: "Nam",
      ngaySinh: "2000-01-01",
      diaChi: "1 Đường Test",
      email: "a@example.test",
    });
    assert.equal(draft.ho, "Trần Minh");
    assert.equal(draft.ten, "Anh");
    assert.equal(draft.diaChi, "1 Đường Test");
  });

  it("maps nulls to empty strings and null customer to empty draft", () => {
    const draft = draftFromCustomer({
      ho: "",
      ten: "",
      gioiTinh: null,
      ngaySinh: null,
      diaChi: null,
      email: null,
    });
    assert.deepEqual(draft, { ...EMPTY_DRAFT });
    assert.deepEqual(draftFromCustomer(null), EMPTY_DRAFT);
  });
});
