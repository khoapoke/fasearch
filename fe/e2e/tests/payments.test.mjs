// [payments] Read-only contract checks against the BE (E2E_API_URL). No payment provider is ever called.
import { test } from "node:test";
import assert from "node:assert/strict";
import { suite } from "../lib/suite.mjs";
import { cfg } from "../lib/config.mjs";
import { Client } from "../lib/http.mjs";
import { step } from "../lib/steps.mjs";

suite("payments", "payment endpoints (no provider calls)", () => {
  test("methods / unsigned IPN / webhook verb", async (t) => {
    const be = new Client(cfg.apiUrl);
    const m = await be.req("GET", "/api/v1/payments/methods", { origin: false });
    await step(t, "payments methods endpoint answers 200", () => assert.equal(m.code, 200, `http ${m.code}`));
    const ipn = await be.req("GET", "/api/v1/payments/vnpay/ipn", { origin: false });
    await step(t, "unsigned VNPAY IPN is rejected (RspCode 97), not processed", () => assert.ok(ipn.code === 200 && ipn.j?.RspCode === "97", `http ${ipn.code} ${JSON.stringify(ipn.j)?.slice(0, 80)}`));
    const wh = await be.req("GET", "/api/v1/payments/stripe/webhook", { origin: false });
    await step(t, "Stripe webhook GET -> 405", () => assert.equal(wh.code, 405));
    const whp = await be.req("POST", "/api/v1/payments/stripe/webhook", { body: {}, origin: false });
    await step(t, "Stripe webhook POST without signature is refused (4xx)", () => assert.ok(whp.code >= 400 && whp.code < 500, `http ${whp.code}`));
    const att = await be.req("GET", "/api/v1/payments/attempts", { origin: false });
    await step(t, "payment attempts require authentication (401/403)", () => assert.ok([401, 403].includes(att.code), `http ${att.code}`));
  }, );
}, { needs: ["api"] });
