// Run: node --test tests/motion-sitewide.test.mjs (from fe/)
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { motionBootScript, MOTION_STORAGE_KEY } from "../src/lib/motion-boot.ts";

const src = resolve(dirname(fileURLToPath(import.meta.url)), "../src");
const read = (p) => readFileSync(join(src, p), "utf8");

describe("sitewide motion", () => {
  it("boot script sets html[data-motion=off] only for the stored 'off'", () => {
    const attrs = {};
    const doc = { documentElement: { setAttribute: (k, v) => { attrs[k] = v; } } };
    const run = (stored) => { for (const k in attrs) delete attrs[k]; new Function("localStorage", "document", motionBootScript())({ getItem: () => stored }, doc); return { ...attrs }; };
    assert.deepEqual(run("off"), { "data-motion": "off" });
    assert.deepEqual(run("auto"), {});
    assert.deepEqual(run(null), {});
    assert.equal(MOTION_STORAGE_KEY, "fa-motion");
  });
  it("layout runs the boot script; globals.css honours Off like reduced-motion", () => {
    assert.match(read("app/layout.tsx"), /motionBootScript/);
    const css = read("app/globals.css");
    assert.match(css, /html\[data-motion="off"\] \*/);
    assert.match(css, /prefers-reduced-motion: reduce/);
  });
  it("quantity steppers stop at limits and animate only transform/opacity", () => {
    assert.match(read("app/san-pham/[id]/detail-view.tsx"), /disabled=\{quantity <= 1\}/);
    assert.match(read("app/gio-hang/page.tsx"), /line\.quantity >= 999/);
    const keyframes = read("components/ui/motion.css").match(/@keyframes qty-tick \{[^}]*\}/)?.[0] ?? "";
    assert.match(keyframes, /opacity/);
    assert.doesNotMatch(keyframes, /width|height|margin|padding/);
  });
});
