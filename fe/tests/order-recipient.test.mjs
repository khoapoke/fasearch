// Run: node --test tests/order-recipient.test.mjs   (from fe/)
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parseOrderNote, stripRecipientToken, parseCustomerOrderNote } from "../src/lib/order-recipient.ts";

describe("parseOrderNote", () => {
  it("reads the recipient and leaves real note text", () => {
    const r = parseOrderNote("[Người nhận: Lê An - 0961225593] Giao giờ hành chính");
    assert.deepEqual(r.recipient, { name: "Lê An", phone: "0961225593" });
    assert.equal(r.text, "Giao giờ hành chính");
  });
  it("keeps text before and after the token", () => {
    const r = parseOrderNote("Gọi trước khi giao [Người nhận: Lê An - 0961225593] để lại bảo vệ");
    assert.equal(r.recipient?.phone, "0961225593");
    assert.equal(r.text, "Gọi trước khi giao để lại bảo vệ");
  });
  it("returns no recipient when there is no token", () => {
    const r = parseOrderNote("Giao nhanh giúp mình");
    assert.equal(r.recipient, null);
    assert.equal(r.text, "Giao nhanh giúp mình");
    assert.deepEqual(parseOrderNote(null), { recipient: null, text: "" });
  });
  it("handles a hyphen inside the recipient name", () => {
    const r = parseOrderNote("[Người nhận: Nguyễn Thị Lan - Anh - 0901234567] ");
    assert.deepEqual(r.recipient, { name: "Nguyễn Thị Lan - Anh", phone: "0901234567" });
    assert.equal(r.text, "");
  });
  it("strips the token only", () => {
    assert.equal(stripRecipientToken("a [Người nhận: X - 1] b").replace(/\s+/g, " "), "a b");
  });
});

it("prepares a token note for printing without internal status messages", () => {
  const note = parseCustomerOrderNote("Gọi trước [Người nhận: Demo Cầm - 0911000001] | [PACKING]: Đang đóng gói");
  assert.deepEqual(note.recipient, { name: "Demo Cầm", phone: "0911000001" });
  assert.equal(note.text, "Gọi trước");
});
