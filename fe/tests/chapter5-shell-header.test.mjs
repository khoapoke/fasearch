import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOT = new URL("../src", import.meta.url).pathname;

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

function shellTagOf(file) {
  const text = readFileSync(file, "utf8");
  const match = text.match(/<StorefrontShell[\s\S]*?>/);
  return match ? match[0] : "";
}

describe("Chapter 5 account shell header/footer consistency", () => {
  it("AccountCenterShell uses the approved Customer header, palette, theme and no legacy footer", () => {
    const tag = shellTagOf(join(ROOT, "components/storefront/account-center-shell.tsx"));
    assert.ok(tag, "AccountCenterShell must render StorefrontShell");
    assert.match(tag, /header="customer"/, "account pages must use the approved Customer header");
    assert.match(tag, /palette="customer"/, "account pages must use the approved Customer palette");
    assert.match(tag, /\bthemed\b/, "account pages must stay on the themed canvas");
    assert.match(tag, /footer="none"/, "account pages must not fall back to the legacy storefront footer");
    assert.doesNotMatch(tag, /header="customer-focused"/, "account pages are not login screens");
  });

  it("keeps AccountCenterShell aligned with the accepted /tai-khoan hub", () => {
    const hub = shellTagOf(join(ROOT, "app/tai-khoan/page.tsx"));
    const center = shellTagOf(join(ROOT, "components/storefront/account-center-shell.tsx"));
    for (const prop of ['active="/tai-khoan"', 'palette="customer"', 'header="customer"', 'footer="none"']) {
      assert.ok(hub.includes(prop), `/tai-khoan hub is expected to keep ${prop}`);
      assert.ok(center.includes(prop), `AccountCenterShell must match the hub prop ${prop}`);
    }
  });

  it("never renders a bare StorefrontShell on published account routes", () => {
    const accountRouteRoots = ["app/tai-khoan", "app/yeu-thich", "app/lich-su-ai", "app/voucher", "app/don-hang", "components/storefront/account-center-shell.tsx"];
    const offenders = accountRouteRoots
      .flatMap((entry) => {
        const path = join(ROOT, entry);
        return statSync(path).isDirectory() ? walk(path) : [path];
      })
      .filter((file) => file.endsWith(".tsx"))
      .map((file) => ({ file, tag: shellTagOf(file) }))
      .filter(({ tag }) => tag && !tag.includes("header="))
      .map(({ file }) => file.replace(ROOT, "src"));
    assert.deepEqual(offenders, [], `these account shells would fall back to the legacy orange header: ${offenders.join(", ")}`);
  });
});
