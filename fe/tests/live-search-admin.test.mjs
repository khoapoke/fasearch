// Admin live-search contracts: debounce/IME, URL mirroring and stale responses.
// Run: node --test tests/live-search-admin.test.mjs   (from the fe/ directory)
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  acceptResponse,
  beginRequest,
  debounceDecision,
  failResponse,
  LIVE_SEARCH_DEBOUNCE_MS,
  LIVE_SEARCH_MAX_LENGTH,
  normalizeTerm,
  searchUrl,
} from "../src/lib/live-search.ts";

describe("debounce decisions", () => {
  it("debounces around 300ms", () => {
    assert.ok(LIVE_SEARCH_DEBOUNCE_MS >= 250 && LIVE_SEARCH_DEBOUNCE_MS <= 400);
  });

  it("never schedules a request mid IME composition", () => {
    assert.deepEqual(debounceDecision("quần", "", true), { kind: "skip" });
    assert.deepEqual(debounceDecision("quan", "quan", true), { kind: "skip" });
  });

  it("does not fire a one-character auto search", () => {
    assert.deepEqual(debounceDecision("q", "", false), { kind: "tooShort" });
    assert.deepEqual(debounceDecision(" ", "", false), { kind: "skip" });
  });

  it("commits from two characters, keeps accents and trims spaces", () => {
    assert.deepEqual(debounceDecision("qu", "", false), { kind: "commit", term: "qu" });
    assert.deepEqual(debounceDecision("  Quần   jeans  ", "", false), { kind: "commit", term: "Quần jeans" });
  });

  it("does not resend the committed term", () => {
    assert.deepEqual(debounceDecision("quan jeans", "quan jeans", false), { kind: "skip" });
  });

  it("caps the server-bound term", () => {
    const long = "a".repeat(LIVE_SEARCH_MAX_LENGTH + 10);
    assert.equal(normalizeTerm(long).length, LIVE_SEARCH_MAX_LENGTH);
  });
});

describe("request state", () => {
  const page = (name) => ({ content: [name], pageNumber: 0, pageSize: 10, totalElements: 1, totalPages: 1, last: true });

  it("keeps the previous rows visible while a newer request loads", () => {
    let state = { data: page("first"), loading: false, error: null, version: 1 };
    state = beginRequest(state, 2);
    assert.deepEqual(state.data, page("first"));
    assert.equal(state.loading, true);
    assert.equal(state.version, 2);
  });

  it("drops a slow response from an older request", () => {
    let state = beginRequest({ data: page("first"), loading: false, error: null, version: 1 }, 2);
    const stale = acceptResponse(state, 1, page("stale"));
    assert.deepEqual(stale.data, page("first"));
    assert.equal(stale.loading, true);
    assert.equal(stale.version, 2);
  });

  it("accepts only the newest response", () => {
    const state = beginRequest({ data: page("first"), loading: false, error: null, version: 1 }, 2);
    const fresh = acceptResponse(state, 2, page("second"));
    assert.deepEqual(fresh.data, page("second"));
    assert.equal(fresh.loading, false);
    assert.equal(fresh.error, null);
  });

  it("drops stale failures and keeps the newest error", () => {
    const state = beginRequest({ data: null, loading: false, error: null, version: 1 }, 2);
    assert.deepEqual(failResponse(state, 1, "old"), state);
    const failed = failResponse(state, 2, "new");
    assert.equal(failed.error, "new");
    assert.equal(failed.loading, false);
  });
});

describe("URL mirroring", () => {
  it("keeps the query and filters and omits blanks plus page 0", () => {
    assert.equal(
      searchUrl("/quan-tri/san-pham", { keyword: "quần", categoryId: "3", status: "", page: null }),
      "/quan-tri/san-pham?keyword=qu%E1%BA%A7n&categoryId=3",
    );
  });

  it("restores a page number only when it is not the first page", () => {
    assert.equal(searchUrl("/quan-tri/don-hang", { keyword: "", status: "PENDING", page: 2 }), "/quan-tri/don-hang?status=PENDING&page=2");
    assert.equal(searchUrl("/quan-tri/ton-kho", { keyword: "26", page: null }), "/quan-tri/ton-kho?keyword=26");
    assert.equal(searchUrl("/quan-tri/ton-kho", { keyword: "26", page: 0 }), "/quan-tri/ton-kho?keyword=26&page=0");
  });
});
