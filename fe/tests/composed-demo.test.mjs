// Regression checks for the landing composed-demo fixtures
// (AC: deterministic sample scores, rank order, provisional request shape).
// Run: node --test tests/composed-demo.test.mjs   (from the fe/ directory)

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  COMPOSED_QUERIES,
  COMPOSED_SCENES,
} from "../src/components/stitch-search/composed-demo/composed-scenes.ts";

describe("composed demo fixtures", () => {
  it("has two scenes with three presets each", () => {
    assert.equal(COMPOSED_SCENES.length, 2);
    assert.equal(COMPOSED_QUERIES.length, 2);
    for (const scene of COMPOSED_SCENES) {
      assert.equal(scene.presets.length, 3);
      assert.equal(scene.results.length, 3);
      assert.equal(scene.k, 3);
    }
  });

  it("keeps fixture scores in descending rank order", () => {
    for (const scene of COMPOSED_SCENES) {
      for (const preset of scene.presets) {
        const [a, b, c] = preset.scores;
        assert.ok(a > b && b > c, `scores out of order: ${preset.scores}`);
        assert.ok(a < 1 && c > 0, `scores out of range: ${preset.scores}`);
      }
    }
  });

  it("anchors and results reference known scene garments", () => {
    for (const scene of COMPOSED_SCENES) {
      const ids = new Set(scene.results.map((item) => item.id));
      assert.ok(ids.has(scene.anchor.id), `anchor ${scene.anchor.id} not in results`);
      for (const item of scene.results) {
        assert.match(item.id, /^[a-z-]+$/);
        assert.ok(item.name.length > 0 && item.category.length > 0);
      }
    }
  });

  it("keeps staged edit texts non-empty and distinct per scene", () => {
    for (const scene of COMPOSED_SCENES) {
      const texts = scene.presets.map((preset) => preset.text);
      assert.equal(new Set(texts).size, 3);
      for (const text of texts) assert.ok(text.trim().length > 0);
    }
  });
});
