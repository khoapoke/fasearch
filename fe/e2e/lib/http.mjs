// Minimal cookie-jar HTTP client (port of the rehearsal fsr.py client). Credentials only travel in
// request bodies; nothing is printed.
import { randomUUID } from "node:crypto";
import { cfg } from "./config.mjs";

export class Client {
  constructor(base = cfg.baseUrl) { this.base = base; this.jar = new Map(); }
  cookieHeader() { return [...this.jar].map(([k, v]) => `${k}=${v}`).join("; "); }
  absorb(res) {
    const sc = typeof res.headers.getSetCookie === "function" ? res.headers.getSetCookie() : [];
    for (const c of sc) {
      const [pair, ...attrs] = c.split(";");
      const i = pair.indexOf("=");
      const name = pair.slice(0, i).trim(), val = pair.slice(i + 1).trim();
      const expired = attrs.some((a) => /^\s*max-age=0\s*$/i.test(a)) || val === "";
      if (expired) this.jar.delete(name); else this.jar.set(name, val);
    }
  }
  /** -> { code, j (parsed JSON or null), buf (Buffer), ct, text() } ; code 0 on network error. */
  async req(method, path, { body, raw, ctype, origin = true, timeout = 60000, headers = {} } = {}) {
    const h = { ...headers };
    let data;
    if (body !== undefined) { data = JSON.stringify(body); h["content-type"] = "application/json"; }
    if (raw !== undefined) { data = raw; if (ctype) h["content-type"] = ctype; }
    if (origin) h.origin = this.base;
    const ck = this.cookieHeader(); if (ck) h.cookie = ck;
    try {
      const res = await fetch(this.base + path, { method, headers: h, body: data, redirect: "manual", signal: AbortSignal.timeout(timeout) });
      this.absorb(res);
      const buf = Buffer.from(await res.arrayBuffer());
      const ct = res.headers.get("content-type") || "";
      let j = null;
      if (ct.includes("json")) { try { j = JSON.parse(buf.toString("utf8")); } catch { /* keep null */ } }
      return { code: res.status, j, buf, ct, location: res.headers.get("location") || "", text: () => buf.toString("utf8") };
    } catch (e) {
      return { code: 0, j: { _err: e?.name || "Error" }, buf: Buffer.alloc(0), ct: "", location: "", text: () => "" };
    }
  }
  /** Fetch a page following same-origin redirects; returns { code, url (path), body }. */
  async page(path, maxHops = 5) {
    let p = path;
    for (let i = 0; i <= maxHops; i++) {
      const r = await this.req("GET", p, { origin: false });
      if (r.code >= 300 && r.code < 400 && r.location) { p = r.location.replace(this.base, ""); continue; }
      return { code: r.code, url: p, body: r.text() };
    }
    return { code: 310, url: p, body: "" };
  }
  setAttempt() { this.jar.set("fasearch-auth-current-3139", randomUUID().replace(/-/g, "") + randomUUID().slice(0, 8)); }
  async login(user, pw) { this.setAttempt(); return this.req("POST", "/api/customer-auth/login", { body: { username: user, password: pw } }); }
  logout() { return this.req("POST", "/api/customer-auth/logout", { body: {} }); }
}

export const res = (j) => (j || {}).result;
export const msg = (j) => (j && typeof j === "object" ? String(j.message || j.code || j._err || "").slice(0, 160) : "");
