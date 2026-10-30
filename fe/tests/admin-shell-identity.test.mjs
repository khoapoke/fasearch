import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = readFileSync(join(root, "src/components/admin/admin-shell.tsx"), "utf8");

describe("legacy AdminShell identity", () => {
  it("shows candidate JWT identity only for ADMIN/STAFF, retaining the legacy session fallback", () => {
    assert.match(source, /authMe\(\)[\s\S]*?identity\.role === "ADMIN" \|\| identity\.role === "STAFF"[\s\S]*?setMe\(\{ id: identity\.id, username: identity\.username, email: identity\.email, role: identity\.role, authenticated: true \}\)/);
    assert.match(source, /\.catch\(\(\) => \{\s*void readOwnIdentity\(\)/);
  });
});
