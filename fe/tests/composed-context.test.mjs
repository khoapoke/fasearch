import { it } from "node:test";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

it("actual PRODUCT component rejects stale validation and search across context transitions", () => {
  execFileSync(process.execPath, [fileURLToPath(new URL("../../tools/catalog-discovery/verify-composed-context.cjs", import.meta.url))], { stdio: "pipe" });
});
