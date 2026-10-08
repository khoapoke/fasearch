// TEXT view-state races (S1–S4, revision2): draft vs submitted snapshot vs
// settled results. Pure transitions, no DOM/fetch.
// Run: node --test tests/text-state.test.mjs   (from the fe/ directory)

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  editDraft,
  initialView,
  isStaleResponse,
  resetView,
  settleFailure,
  settleSuccess,
  validationFailure,
} from "../src/components/text-search/search-state.ts";

const dataFor = (ids) => ({
  results: ids.map((id, i) => ({ product_id: id, rank: i + 1 })),
});

describe("text search view-state", () => {
  it("typing never discards the last settled success (S1)", () => {
    const snap = { text: "váy đỏ", k: 10 };
    let view = { ...initialView(), pending: snap };
    const settled = settleSuccess(view, snap, dataFor(["a"]));
    assert.ok(settled && settled.settled);
    const edited = editDraft(settled, { draftText: "váy đỏ tay dài" });
    assert.equal(edited.draftText, "váy đỏ tay dài");
    assert.equal(edited.settled.data.results[0].product_id, "a");
    assert.equal(edited.settled.submitted.text, "váy đỏ");
    assert.equal(edited.pending, null);
  });

  it("editing during pending exits the skeleton; late response is ignored (S4)", () => {
    const snap = { text: "váy đỏ", k: 10 };
    const old = settleSuccess({ ...initialView(), pending: snap }, snap, dataFor(["a"]));
    const snap2 = { text: "váy xanh", k: 10 };
    let pending = { ...old, pending: snap2 };
    pending = editDraft(pending, { draftText: "váy xanh đậm" });
    assert.equal(pending.pending, null);
    assert.equal(pending.settled.data.results[0].product_id, "a");
    assert.ok(isStaleResponse(pending, snap2));
    assert.equal(settleSuccess(pending, snap2, dataFor(["b"])), null);
    assert.equal(settleFailure(pending, snap2, { message: "x" }), null);
  });

  it("current success replaces old results; empty success is honest (S3)", () => {
    const s1 = { text: "váy đỏ", k: 10 };
    const v1 = settleSuccess({ ...initialView(), pending: s1 }, s1, dataFor(["a", "b"]));
    const s2 = { text: "quần đen", k: 5 };
    const v2 = settleSuccess({ ...v1, pending: s2 }, s2, dataFor([]));
    assert.equal(v2.settled.data.results.length, 0);
    assert.equal(v2.settled.submitted.text, "quần đen");
    assert.equal(v2.failure, null);
  });

  it("failure retains previous success with the old query label (S3)", () => {
    const s1 = { text: "váy đỏ", k: 10 };
    const v1 = settleSuccess({ ...initialView(), pending: s1 }, s1, dataFor(["a"]));
    const s2 = { text: "quần đen", k: 5 };
    const failed = settleFailure({ ...v1, pending: s2 }, s2, { message: "boom" });
    assert.equal(failed.settled.data.results[0].product_id, "a");
    assert.equal(failed.failure.message, "boom");
    assert.equal(failed.failure.failed.text, "quần đen");
    assert.equal(failed.pending, null);
  });

  it("validation failure starts no request and keeps settled results", () => {
    const s1 = { text: "váy đỏ", k: 10 };
    const v1 = settleSuccess({ ...initialView(), pending: s1 }, s1, dataFor(["a"]));
    const draft = { ...v1, draftText: "   " };
    const failed = validationFailure(draft, "Nhập mô tả");
    assert.equal(failed.pending, null);
    assert.equal(failed.settled.data.results[0].product_id, "a");
    assert.match(failed.failure.message, /Nhập mô tả/);
  });

  it("reset clears draft, results, errors and pending", () => {
    const s1 = { text: "váy đỏ", k: 10 };
    settleSuccess(
      { ...initialView(), pending: s1, draftText: "x" }, s1, dataFor(["a"]),
    );
    const reset = resetView();
    assert.equal(reset.draftText, "");
    assert.equal(reset.settled, null);
    assert.equal(reset.failure, null);
    assert.equal(reset.pending, null);
    assert.ok(isStaleResponse(reset, s1));
  });

  it("submit reads the latest view: pending blocks, settled snapshots latest draft", () => {
    // Contract preserved by the commit-phase viewRef sync in the workbench:
    // handleSubmit must observe the newest committed view, so a second
    // submit while pending is ignored and the snapshot freezes the draft
    // as of submit time (later typing cannot mutate it).
    const first = { text: "váy đỏ", k: 10 };
    const pendingView = { ...initialView(), pending: first };
    assert.ok(pendingView.pending, "second submit must see pending and return early");
    const settled = settleSuccess(pendingView, first, dataFor(["a"]));
    assert.ok(settled && settled.pending === null);
    const snapshot = { text: settled.draftText || first.text, k: settled.draftK };
    const withPending = { ...settled, pending: snapshot };
    const edited = editDraft(withPending, { draftText: "váy xanh" });
    assert.equal(edited.pending, null, "typing during pending exits the skeleton");
    assert.equal(withPending.pending.text, first.text,
      "submitted snapshot keeps submit-time text");
  });
});
