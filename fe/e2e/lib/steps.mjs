// Small assertion helpers shared by the API-journey suites (port of the rehearsal chk()/page()).
import assert from "node:assert/strict";
import { knownReason } from "./config.mjs";
import { res, msg } from "./http.mjs";

export { res, msg };
export const BADMARK = ["Application error: a", "Internal Server Error", "Unhandled Runtime Error"];

/** Run a named subtest. Extra options: { todo } for documented limitations. */
export function step(t, name, fn, opts = {}) {
  const todo = opts.todo ?? knownReason(name);
  return t.test(name, todo ? { todo } : {}, fn);
}

/** Assert an HTTP response (status in `ok`, optional payload predicate). Returns the parsed JSON. */
export async function chk(t, name, r, { ok = [200], pred, todo } = {}) {
  await step(t, name, () => {
    assert.ok(ok.includes(r.code), `${name}: http ${r.code} ${msg(r.j)}`);
    if (pred) assert.ok(pred(r.j, r), `${name}: unexpected payload (http ${r.code})`);
  }, { todo });
  return r.j;
}

/** Fetch an HTML page through the FE and check title / error markers / (optionally) no redirect. */
export async function pageChk(t, name, client, path, { expectPath = true, todo } = {}) {
  const p = await client.page(path);
  await step(t, name, () => {
    assert.equal(p.code, 200, `${name}: http ${p.code} final=${p.url.slice(0, 80)}`);
    assert.ok(p.body.includes("<title>"), `${name}: no <title>`);
    assert.ok(!BADMARK.some((m) => p.body.includes(m)), `${name}: error marker in HTML`);
    if (expectPath) assert.equal(p.url.split("?")[0], path.split("?")[0], `${name}: redirected to ${p.url.slice(0, 80)}`);
  }, { todo });
  return p.body;
}

export function multipart(fields, file) {
  const b = "----e2e" + Math.random().toString(16).slice(2);
  const parts = [];
  for (const [k, v] of Object.entries(fields)) parts.push(Buffer.from(`--${b}\r\nContent-Disposition: form-data; name="${k}"\r\n\r\n${v}\r\n`));
  if (file) parts.push(Buffer.from(`--${b}\r\nContent-Disposition: form-data; name="file"; filename="${file.name}"\r\nContent-Type: ${file.type}\r\n\r\n`), file.buf, Buffer.from("\r\n"));
  parts.push(Buffer.from(`--${b}--\r\n`));
  return { raw: Buffer.concat(parts), ctype: "multipart/form-data; boundary=" + b };
}

export const today = () => new Date().toISOString().slice(0, 10);
export const daysAgo = (n) => new Date(Date.now() - n * 864e5).toISOString().slice(0, 10);
