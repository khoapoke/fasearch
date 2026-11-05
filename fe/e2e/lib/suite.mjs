// Tagged suites: a suite is skipped (with an explicit reason) when its group is not selected,
// when it needs write mode but E2E_MODE is readonly, or when a required capability is absent.
import { describe } from "node:test";
import { cfg, groupSelected, assertWriteAllowed } from "./config.mjs";

export function suite(groups, name, fn, { write = false, needs = [] } = {}) {
  const tag = `[${[].concat(groups).join("+")}${write ? ":write" : ""}] ${name}`;
  if (!groupSelected(groups)) return describe(tag, { skip: `group not selected (E2E_GROUPS=${cfg.groups.join(",")})` }, () => {});
  if (!cfg.baseUrl) throw new Error("E2E_BASE_URL is required");
  if (write) {
    if (cfg.mode !== "write") return describe(tag, { skip: "write suite: readonly mode (E2E_MODE=write + guards required)" }, () => {});
    assertWriteAllowed(); // throws -> suite file fails loudly instead of writing somewhere unsafe
  }
  for (const n of needs) {
    if (n === "api" && !cfg.apiUrl) return describe(tag, { skip: "needs E2E_API_URL" }, () => {});
  }
  return describe(tag, fn);
}
