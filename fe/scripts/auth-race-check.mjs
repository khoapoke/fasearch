// Cookie-ownership race regressions for REVIEW-AUTH-ASYNC-02.
// A local forward proxy holds only the selected downstream response; requests
// are never fetched-and-replayed, so no cookie jar can mask a stale response.
// Usage: node scripts/auth-race-check.mjs <feBase> <outDir>
import http from "node:http";
import { randomUUID } from "node:crypto";
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const base = process.argv[2] ?? "http://127.0.0.1:3115";
const outDir = process.argv[3];
if (!process.argv[3]) { console.error("dùng: node scripts/auth-race-check.mjs <feBase> <outDir>"); process.exit(1); }
mkdirSync(outDir, { recursive: true });
const target = new URL(base);
const proxyPort = 3118;
const held = [];
const proxy = http.createServer((request, response) => {
  const chunks = [];
  request.on("data", (chunk) => chunks.push(chunk));
  request.on("end", () => {
    const body = Buffer.concat(chunks);
    const upstream = http.request({
      host: target.hostname, port: target.port, path: request.url, method: request.method,
      headers: { ...request.headers, "content-length": body.length },
    }, (upstreamResponse) => {
      const parts = [];
      upstreamResponse.on("data", (chunk) => parts.push(chunk));
      upstreamResponse.on("end", () => {
        const result = { status: upstreamResponse.statusCode, headers: upstreamResponse.headers, body: Buffer.concat(parts) };
        if (request.headers["x-hold"] === "yes") held.push({ result, response });
        else { response.writeHead(result.status, result.headers); response.end(result.body); }
      });
    });
    upstream.on("error", () => { response.writeHead(502); response.end(); });
    upstream.end(body);
  });
});
await new Promise((resolve) => proxy.listen(proxyPort, "127.0.0.1", resolve));

const setCookies = (headers) => Array.isArray(headers["set-cookie"]) ? headers["set-cookie"] : (headers["set-cookie"] ? [headers["set-cookie"]] : []);
const cookieName = (setCookie) => setCookie ? setCookie.split(";")[0].split("=")[0] : null;
const authFrom = (result) => {
  const item = setCookies(result.headers).find((value) => cookieName(value).startsWith("fasearch-auth-pilot-3115"));
  return item ? item.split(";")[0] : null;
};
function call(path, body, { hold = false, attempt = null, auth = null, method = "POST" } = {}) {
  return new Promise((resolve, reject) => {
    const data = body === undefined ? null : Buffer.from(JSON.stringify(body));
    const cookie = [attempt ? `fasearch-auth-current-3115=${attempt}` : null, auth].filter(Boolean).join("; ") || null;
    const request = http.request({
      host: "127.0.0.1", port: proxyPort, path, method,
      headers: {
        origin: base, "content-type": "application/json",
        ...(data ? { "content-length": data.length } : {}),
        ...(cookie ? { cookie } : {}),
        ...(hold ? { "x-hold": "yes" } : {}),
      },
    }, (response) => {
      const parts = [];
      response.on("data", (chunk) => parts.push(chunk));
      response.on("end", () => {
        const raw = Buffer.concat(parts).toString();
        resolve({ status: response.statusCode, headers: response.headers, setCookies: setCookies(response.headers), json: raw ? JSON.parse(raw) : {} });
      });
    });
    request.on("error", reject);
    if (data) request.write(data);
    request.end();
  });
}
async function waitHeld() {
  for (let i = 0; i < 200; i++) {
    if (held.length) return held.shift();
    await new Promise((resolve) => setTimeout(resolve, 15));
  }
  throw new Error("held response did not arrive");
}
function release({ result, response }) {
  response.writeHead(result.status, result.headers);
  response.end(result.body);
}
const results = [];
const record = (name, ok, detail) => { results.push({ name, ok, detail }); console.log(`${ok ? "OK  " : "FAIL"} ${name} — ${JSON.stringify(detail)}`); };
const username = (tag) => `race_${tag}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
const password = "RacePilot!2026";
const account = async (tag) => {
  const name = username(tag);
  const result = await call("/api/customer-auth/register", {
    username: name, password, email: `${name}@example.test`,
    lastName: "Race", phoneNumber: `07${Math.floor(Math.random() * 100000000).toString().padStart(8, "0")}`,
  }, { attempt: randomUUID() });
  if (result.status !== 200) throw new Error(`registration failed ${result.status}`);
  return { name, password };
};
const a = await account("a");
const b = await account("b");
const c = await account("c");
const login = (who, attempt, options = {}) => call("/api/customer-auth/login", { username: who.name, password: who.password }, { attempt, ...options });
const me = (attempt, auth, options = {}) => call("/api/customer-auth/me", undefined, { method: "GET", attempt, auth, ...options });

// 1. stale login A must not become the selected credential after B.
const loginAAttempt = randomUUID();
const b1Attempt = randomUUID();
const oldLogin = login(a, loginAAttempt, { hold: true });
const loginHold = await waitHeld();
const b1 = await login(b, b1Attempt);
const b1Auth = authFrom(b1);
release(loginHold);
const lateA = await oldLogin;
const meB = await me(b1Attempt, b1Auth);
record("RACE login A after B: /me stays B, stale namespaced cookie is not selected", b1.status === 200 && meB.status === 200 && meB.json.identity?.username === b.name && cookieName(authFrom(lateA)) !== cookieName(b1Auth), { bStatus: b1.status, lateAStatus: lateA.status, meStatus: meB.status, identityB: meB.json.identity?.username === b.name, namespaced: cookieName(authFrom(lateA)) !== cookieName(b1Auth) });

// 2. stale /me 401 must clear only its own attempt, not B's credential.
const staleAttempt = randomUUID();
const b2Attempt = randomUUID();
const oldMe = me(staleAttempt, `fasearch-auth-pilot-3115.${staleAttempt}=tampered`, { hold: true });
const meHold = await waitHeld();
const b2 = await login(b, b2Attempt);
const b2Auth = authFrom(b2);
release(meHold);
const lateMe = await oldMe;
const meB2 = await me(b2Attempt, b2Auth);
record("RACE stale /me 401 after newer login: B credential remains", lateMe.status === 401 && b2.status === 200 && meB2.status === 200 && meB2.json.identity?.username === b.name, { staleMeStatus: lateMe.status, bStatus: b2.status, currentStatus: meB2.status });

// 3. stale logout must not delete a newer login.
const a3Attempt = randomUUID();
const oldLogout = call("/api/customer-auth/logout", {}, { hold: true, attempt: b2Attempt, auth: b2Auth });
const logoutHold = await waitHeld();
const a3 = await login(a, a3Attempt);
const a3Auth = authFrom(a3);
release(logoutHold);
const lateLogout = await oldLogout;
const meA3 = await me(a3Attempt, a3Auth);
record("RACE stale logout after newer login: newer credential remains", lateLogout.status === 200 && a3.status === 200 && meA3.status === 200 && meA3.json.identity?.username === a.name, { logoutStatus: lateLogout.status, newerLoginStatus: a3.status, currentStatus: meA3.status });

// 4. login completing after local signout must not re-authenticate the signed-out pointer.
const b4Attempt = randomUUID();
const b4 = await login(b, b4Attempt);
const b4Auth = authFrom(b4);
const lateLoginAttempt = randomUUID();
const lateLogin = login(a, lateLoginAttempt, { hold: true });
const lateHold = await waitHeld();
const logoutB = await call("/api/customer-auth/logout", {}, { attempt: b4Attempt, auth: b4Auth });
release(lateHold);
const afterLateLogin = await lateLogin;
const afterSignout = await me(b4Attempt);
record("RACE login after local signout: no reauthentication of current pointer", logoutB.status === 200 && afterLateLogin.status === 200 && afterSignout.status === 401, { logoutStatus: logoutB.status, lateLoginStatus: afterLateLogin.status, currentStatus: afterSignout.status, code: afterSignout.json.code });

// 5. stale register response must not replace a newer login.
const cAttempt = randomUUID();
const oldRegister = call("/api/customer-auth/register", {
  username: username("late"), password, email: `${username("late")}@example.test`,
  lastName: "Race", phoneNumber: `06${Math.floor(Math.random() * 100000000).toString().padStart(8, "0")}`,
}, { hold: true, attempt: cAttempt });
const registerHold = await waitHeld();
const b5Attempt = randomUUID();
const b5 = await login(b, b5Attempt);
const b5Auth = authFrom(b5);
release(registerHold);
const lateRegister = await oldRegister;
const meB5 = await me(b5Attempt, b5Auth);
record("RACE stale register after newer login: B remains selected", lateRegister.status === 200 && b5.status === 200 && meB5.status === 200 && meB5.json.identity?.username === b.name, { lateRegisterStatus: lateRegister.status, bStatus: b5.status, currentStatus: meB5.status });

writeFileSync(join(outDir, "auth-race-report.json"), JSON.stringify({ cases: results, harness: "downstream-response held at local proxy; no fetch-and-replay; actual BFF/BE; synthetic accounts", completed: true }, null, 2));
proxy.close();
const failed = results.filter((x) => !x.ok);
console.log(`\n${results.length - failed.length}/${results.length} pass`);
process.exit(failed.length ? 1 : 0);
