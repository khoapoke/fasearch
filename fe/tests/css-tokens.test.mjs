// CSS token regression: changed styles must reference only tokens defined
// in globals.css (repairs the invisible-border/CTA drift).
// Run: node --test tests/css-tokens.test.mjs   (from the fe/ directory)

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const globals = readFileSync(join(root, "src/app/globals.css"), "utf8");
const defined = new Set(
  [...globals.matchAll(/--([a-z][a-z0-9-]*)\s*:/g)].map((m) => `--${m[1]}`),
);

const changed = [
  "src/components/text-search/text-search-workbench.module.css",
  "src/app/search/text/page.module.css",
  "src/components/image-search-workbench.module.css",
];

const legacy = ["--thread", "--thread-dark", "--paper", "--porcelain", "--cobalt", "--aubergine"];

describe("css tokens", () => {
  for (const file of changed) {
    it(`${file} has no legacy undefined tokens`, () => {
      const css = readFileSync(join(root, file), "utf8");
      for (const token of legacy) {
        assert.ok(
          !css.includes(`var(${token})`) && !css.includes(`var(${token}-`),
          `${file} still references ${token}`,
        );
      }
    });

    it(`${file} only uses defined tokens`, () => {
      const css = readFileSync(join(root, file), "utf8");
      const used = new Set(
        [...css.matchAll(/var\((--[a-z][a-z0-9-]*)\)/g)].map((m) => m[1]),
      );
      for (const token of used) {
        assert.ok(defined.has(token), `${file} uses undefined ${token}`);
      }
    });
  }
});
