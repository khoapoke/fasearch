// Run: node --test tests/recently-viewed.test.mjs   (from fe/)
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { RECENT_KEY, RECENT_MAX, pushRecent, readRecent, recordRecent } from "../src/lib/recently-viewed.ts";

const item = (id) => ({ id, name: `Áo ${id}`, price: 199000, image: `/img/${id}.jpg`, href: `/san-pham/${id}` });
const memory = (seed) => {
  const data = new Map(seed === undefined ? [] : [[RECENT_KEY, seed]]);
  return { getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v) };
};

describe("recently viewed", () => {
  it("puts the newest first and removes duplicates", () => {
    const list = pushRecent(pushRecent(pushRecent([], item(1)), item(2)), item(1));
    assert.deepEqual(list.map((x) => x.id), [1, 2]);
  });
  it("caps at 12 and drops the oldest", () => {
    let list = [];
    for (let i = 1; i <= 15; i++) list = pushRecent(list, item(i));
    assert.equal(list.length, RECENT_MAX);
    assert.equal(list[0].id, 15);
    assert.equal(list.at(-1).id, 4);
  });
  it("persists through storage and survives garbage", () => {
    const store = memory();
    recordRecent(item(7), store);
    recordRecent(item(8), store);
    assert.deepEqual(readRecent(store).map((x) => x.id), [8, 7]);
    assert.deepEqual(readRecent(memory("not json")), []);
    assert.deepEqual(readRecent(memory(JSON.stringify([{ id: "x" }, item(3), { ...item(4), href: "javascript:alert(1)" }]))).map((x) => x.id), [3]);
  });
});
