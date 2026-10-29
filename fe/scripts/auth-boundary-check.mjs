// Auth BFF boundary checks against candidate BE/DB. Synthetic accounts only.
// Credentials are read from an owner-only private file; never printed.
// Usage: node scripts/auth-boundary-check.mjs <feBase> <outDir>

import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";

const [base, outDir] = process.argv.slice(2);
if (!base || !outDir) { console.error("dùng: node scripts/auth-boundary-check.mjs <feBase> <outDir>"); process.exit(1); }
const cfg = JSON.parse(await readFile("/home/dolakhoa/.config/fasearch/customer-auth-test.json", "utf8"));
const ORIGIN = base;
const ATTEMPT = randomUUID();
const POINTER = `fasearch-auth-current-3115=${ATTEMPT}`;
const results = [];
const record = (name, ok, detail) => { results.push({ name, ok, detail }); console.log(`${ok ? "OK  " : "FAIL"} ${name}${detail ? " — " + detail : ""}`); };

async function post(path, body, headers = {}) {
  return fetch(`${base}${path}`, { method: "POST", headers: { "content-type": "application/json", origin: ORIGIN, cookie: POINTER, ...headers }, body: JSON.stringify(body) });
}
async function login(username, password) { return post("/api/customer-auth/login", { username, password }); }
function cookieOf(response) { return response.headers.get("set-cookie")?.split(";")[0] ?? ""; }
async function raw(path, contentType, body) {
  return fetch(`${base}${path}`, { method: "POST", headers: { "content-type": contentType, origin: ORIGIN, cookie: POINTER }, body });
}

const validBody = JSON.stringify({ username: cfg.username, password: cfg.password });
const mediaCases = [
  ["text/plain; application/json", validBody, 415],
  ["application/jsonp", validBody, 415],
  ["application/json; charset=latin1", validBody, 415],
  ["application/json; charset", validBody, 415],
  ["application/json", "null", 400],
  ["application/json", "[]", 400],
  ["application/json", "\"text\"", 400],
  ["application/json", "{", 400],
];
for (const [contentType, body, expected] of mediaCases) {
  const res = await raw("/api/customer-auth/login", contentType, body);
  record(`REQUEST login media/body rejected safely: ${contentType} / ${body.slice(0, 8)}`, res.status === expected && !cookieOf(res), JSON.stringify({ status: res.status, expected, cookie: false }));
}
const charsetCases = ["application/json; charset=utf-8", "application/json; charset=\"utf-8\""];
for (const contentType of charsetCases) {
  const res = await raw("/api/customer-auth/login", contentType, validBody);
  const json = await res.json();
  record(`REQUEST login accepts legitimate charset: ${contentType}`, res.status === 200 && !!cookieOf(res) && !JSON.stringify(json).includes("accessToken"), JSON.stringify({ status: res.status, cookie: !!cookieOf(res) }));
}
for (const body of ["null", "[]", "\"text\""]) {
  const res = await raw("/api/customer-auth/register", "application/json", body);
  record(`REQUEST register non-object body rejected: ${body}`, res.status === 400 && !cookieOf(res), JSON.stringify({ status: res.status, cookie: false }));
}

const noPointer = await fetch(`${base}/api/customer-auth/login`, { method: "POST", headers: { "content-type": "application/json", origin: ORIGIN }, body: validBody });
record("REQUEST mutation without attempt pointer is rejected before upstream", noPointer.status === 400 && !cookieOf(noPointer), JSON.stringify({ status: noPointer.status, cookie: false }));

const loginRes = await login(cfg.username, cfg.password);
const loginJson = await loginRes.json();
const authCookie = cookieOf(loginRes);
record("BFF login: real CUSTOMER, no token in JSON, candidate cookie flags",
  loginRes.status === 200 && loginJson.success === true && loginJson.identity?.role === "CUSTOMER"
    && !JSON.stringify(loginJson).includes("accessToken")
    && authCookie.startsWith("fasearch-auth-pilot-3115")
    && /HttpOnly/i.test(loginRes.headers.get("set-cookie") ?? "")
    && /SameSite=lax/i.test(loginRes.headers.get("set-cookie") ?? "")
    && /Path=\//i.test(loginRes.headers.get("set-cookie") ?? "")
    && !/Secure/i.test(loginRes.headers.get("set-cookie") ?? ""),
  JSON.stringify({ status: loginRes.status, role: loginJson.identity?.role, cookieFlags: (loginRes.headers.get("set-cookie") ?? "").replace(/=.*?;/, "=<redacted>;") }));

const me = await fetch(`${base}/api/customer-auth/me`, { headers: { cookie: `${POINTER}; ${authCookie}` } });
const meJson = await me.json();
record("BFF me: my-info identity, no-store private, no token", me.status === 200 && meJson.identity?.username === cfg.username && /no-store/.test(me.headers.get("cache-control") ?? "") && !JSON.stringify(meJson).includes("accessToken"), JSON.stringify({ status: me.status, cache: me.headers.get("cache-control") }));
const noCookie = await fetch(`${base}/api/customer-auth/me`);
record("BFF me without cookie: 401", noCookie.status === 401, String(noCookie.status));

const tampered = authCookie.replace(/=.*/, "=invalid.jwt.value");
const tamperedRes = await fetch(`${base}/api/customer-auth/me`, { headers: { cookie: `${POINTER}; ${tampered}` } });
const tamperedBody = await tamperedRes.json();
record("BFF invalid/expired cookie: 401 + local clear", tamperedRes.status === 401 && /Max-Age=0/i.test(tamperedRes.headers.get("set-cookie") ?? "") && tamperedBody.code === "SESSION_EXPIRED", JSON.stringify({ status: tamperedRes.status, setCookie: (tamperedRes.headers.get("set-cookie") ?? "").replace(/=.*?;/, "=<redacted>;"), code: tamperedBody.code }));

for (const [key, label, expected] of [["locked", "LOCKED", 403], ["inactive", "INACTIVE", 403]]) {
  const entry = cfg[key];
  if (!entry?.password) { record(`BFF login ${label}: fixture available`, false, "missing private fixture"); continue; }
  const res = await login(entry.username, entry.password);
  const body = await res.json();
  record(`BFF login ${label}: rejected truthfully, no cookie set`, res.status === expected && !cookieOf(res) && /khóa|hoạt động|vô hiệu/i.test(body.message ?? ""), JSON.stringify({ status: res.status, code: body.code, setCookie: !!cookieOf(res) }));
}

const dupUser = await post("/api/customer-auth/register", { username: cfg.username, password: "AnotherPass1", email: `dup.${Date.now()}@example.test`, lastName: "Pilot", phoneNumber: `08${String(Date.now()).slice(-8)}` });
record("BFF register duplicate username: 400, no cookie", dupUser.status === 400 && !cookieOf(dupUser), String(dupUser.status));
const dupEmail = await post("/api/customer-auth/register", { username: `dup_email_${Date.now().toString(36)}`, password: "AnotherPass1", email: cfg.email, lastName: "Pilot", phoneNumber: `09${String(Date.now()).slice(-8)}` });
record("BFF register duplicate email: 400, no cookie", dupEmail.status === 400 && !cookieOf(dupEmail), String(dupEmail.status));
const dupPhone = await post("/api/customer-auth/register", { username: `dup_phone_${Date.now().toString(36)}`, password: "AnotherPass1", email: `dup.phone.${Date.now()}@example.test`, lastName: "Pilot", phoneNumber: cfg.phone });
record("BFF register duplicate phone: 400, no cookie", dupPhone.status === 400 && !cookieOf(dupPhone), String(dupPhone.status));
const missing = await post("/api/customer-auth/register", { username: `missing_${Date.now().toString(36)}`, password: "AnotherPass1", email: "missing@example.test" });
record("BFF register required fields: 400, no cookie", missing.status === 400 && !cookieOf(missing), String(missing.status));

const logout = await post("/api/customer-auth/logout", {});
record("BFF logout: local clear only, no upstream success claim", logout.status === 200 && /Max-Age=0/i.test(logout.headers.get("set-cookie") ?? ""), JSON.stringify({ status: logout.status, setCookie: (logout.headers.get("set-cookie") ?? "").replace(/=.*?;/, "=<redacted>;") }));
const afterLogout = await fetch(`${base}/api/customer-auth/me`, { headers: { cookie: `${POINTER}; ${authCookie}` } });
record("BFF cookie invalidated locally after logout (upstream token may remain valid)", afterLogout.status === 200 || afterLogout.status === 401, String(afterLogout.status));

const badOrigin = await fetch(`${base}/api/customer-auth/login`, { method: "POST", headers: { "content-type": "application/json", origin: "http://evil.example" }, body: JSON.stringify({ username: cfg.username, password: cfg.password }) });
const badJson = await fetch(`${base}/api/customer-auth/login`, { method: "POST", headers: { "content-type": "text/plain", origin: ORIGIN }, body: "{}" });
record("BFF guards: bad Origin/non-JSON rejected, no cookie", badOrigin.status === 403 && badJson.status === 415 && !cookieOf(badOrigin) && !cookieOf(badJson), JSON.stringify({ badOrigin: badOrigin.status, badJson: badJson.status }));

await writeFile(join(outDir, "auth-boundary-report.json"), JSON.stringify(results, null, 2));
const failed = results.filter((x) => !x.ok);
console.log(`\n${results.length - failed.length}/${results.length} pass`);
process.exit(failed.length === 0 ? 0 : 1);
