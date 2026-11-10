// Barcode encoders: checksum, structure and decode round trip. Run: node --test tests/barcode.test.mjs
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { code128Values, code128Widths, encodeBarcode, barcodeSvg, ean13CheckDigit, ean13Bits, isValidEan13, isCode128Encodable, QUIET_MODULES, CODE128_PATTERNS } from "../src/lib/barcode.ts";

// Independent fixture: ZXing 3.5.3 Code128Reader.CODE_PATTERNS dumped by reflection (same library the BE uses).
const ZXING = "212222,222122,222221,121223,121322,131222,122213,122312,132212,221213,221312,231212,112232,122132,122231,113222,123122,123221,223211,221132,221231,213212,223112,312131,311222,321122,321221,312212,322112,322211,212123,212321,232121,111323,131123,131321,112313,132113,132311,211313,231113,231311,112133,112331,132131,113123,113321,133121,313121,211331,231131,213113,213311,213131,311123,311321,331121,312113,312311,332111,314111,221411,431111,111224,111422,121124,121421,141122,141221,112214,112412,122114,122411,142112,142211,241211,221114,413111,241112,134111,111242,121142,121241,114212,124112,124211,411212,421112,421211,212141,214121,412121,111143,111341,131141,114113,114311,411113,411311,113141,114131,311141,411131,211412,211214,211232,2331112".split(",");

// Decoder written for the test: bits from the SVG path, run lengths, symbol lookup, checksum, set switching.
function bitsFromSvg(svg) {
  const vb = /viewBox="0 0 (\d+) 1"/.exec(svg); const total = Number(vb[1]);
  const bits = new Array(total).fill(0);
  for (const m of svg.matchAll(/M(\d+) 0h(\d+)v1h-\d+z/g)) for (let k = 0; k < Number(m[2]); k++) bits[Number(m[1]) + k] = 1;
  return bits;
}
function runs(bits) { const out = []; let i = 0; while (i < bits.length) { let j = i; while (j < bits.length && bits[j] === bits[i]) j++; out.push([bits[i], j - i]); i = j; } return out; }
function decodeCode128(svg) {
  const bits = bitsFromSvg(svg);
  const r = runs(bits);
  assert.equal(r[0][0], 0); assert.equal(r[0][1], QUIET_MODULES, "leading quiet zone");
  assert.equal(r[r.length - 1][0], 0); assert.equal(r[r.length - 1][1], QUIET_MODULES, "trailing quiet zone");
  const widths = r.slice(1, -1).map((x) => x[1]).join("");
  // symbols: 6 digits each, stop is 7
  const syms = []; let p = 0;
  while (p < widths.length) { const w6 = widths.slice(p, p + 6); const idx = ZXING.indexOf(w6); if (idx === 106 || (idx === -1 && widths.slice(p) === ZXING[106])) { assert.equal(widths.slice(p), ZXING[106]); syms.push(106); p = widths.length; break; } assert.ok(idx >= 0 && idx < 106, `unknown symbol ${w6} at ${p}`); syms.push(idx); p += 6; }
  assert.equal(syms.at(-1), 106, "stop");
  const check = syms.at(-2); const body = syms.slice(0, -2);
  let sum = body[0]; for (let k = 1; k < body.length; k++) sum += body[k] * k;
  assert.equal(check, sum % 103, "checksum");
  let set = body[0] === 104 ? "B" : body[0] === 105 ? "C" : null; assert.ok(set, "start symbol");
  let text = "";
  for (const v of body.slice(1)) { if (set === "B" && v === 99) set = "C"; else if (set === "C" && v === 100) set = "B"; else if (set === "C") { assert.ok(v <= 99); text += String(v).padStart(2, "0"); } else { assert.ok(v <= 94, "Code B data"); text += String.fromCharCode(v + 32); } }
  return text;
}
function decodeEan13(svg) {
  const bits = bitsFromSvg(svg).slice(QUIET_MODULES, -QUIET_MODULES).join("");
  assert.equal(bits.length, 95);
  assert.equal(bits.slice(0, 3), "101"); assert.equal(bits.slice(45, 50), "01010"); assert.equal(bits.slice(92), "101");
  const L = ["0001101", "0011001", "0010011", "0111101", "0100011", "0110001", "0101111", "0111011", "0110111", "0001011"];
  const G = L.map((c) => [...c].reverse().map((b) => (b === "1" ? "0" : "1")).join(""));
  const R = L.map((c) => [...c].map((b) => (b === "1" ? "0" : "1")).join(""));
  const par = ["LLLLLL", "LLGLGG", "LLGGLG", "LLGGGL", "LGLLGG", "LGGLLG", "LGGGLL", "LGLGLG", "LGLGGL", "LGGLGL"];
  let left = "", pat = "";
  for (let i = 0; i < 6; i++) { const c = bits.slice(3 + i * 7, 10 + i * 7); const l = L.indexOf(c), g = G.indexOf(c); assert.ok(l >= 0 || g >= 0); if (l >= 0) { left += l; pat += "L"; } else { left += g; pat += "G"; } }
  const first = par.indexOf(pat); assert.ok(first >= 0, "parity pattern");
  let right = ""; for (let i = 0; i < 6; i++) { const c = bits.slice(50 + i * 7, 57 + i * 7); const d = R.indexOf(c); assert.ok(d >= 0); right += d; }
  return `${first}${left}${right}`;
}

describe("Code128", () => {
  it("pattern table matches ZXing", () => { assert.deepEqual([...CODE128_PATTERNS], ZXING); assert.equal(ZXING.length, 107); });
  it("every pattern is 11 modules (stop 13) and starts with a bar", () => { ZXING.forEach((p, i) => assert.equal([...p].reduce((a, c) => a + Number(c), 0), i === 106 ? 13 : 11, String(i))); });
  it("known vectors: values and checksum", () => {
    // "PJJ123C": the Wikipedia Code128 example uses Code B; checksum computed by hand: 104 + 48*1 + 42*2 + 42*3 + 17*4 + 18*5 + 19*6 + 35*7 = 104+48+84+126+68+90+114+245 = 879; 879 % 103 = 55
    assert.deepEqual(code128Values("PJJ123C"), [104, 48, 42, 42, 17, 18, 19, 35, 55, 106]);
    // all numeric uses Code C: "123456" -> start C, 12, 34, 56, checksum (105 + 12*1 + 34*2 + 56*3) = 353 % 103 = 44
    assert.deepEqual(code128Values("123456"), [105, 12, 34, 56, 44, 106]);
    // Product code from the store: letters then digits
    assert.deepEqual(code128Values("A1"), [104, 33, 17, (104 + 33 + 17 * 2) % 103, 106]);
  });
  it("switches sets and handles odd digit runs", () => {
    assert.deepEqual(code128Values("1234567"), [104, 17, 99, 23, 45, 67, (104 + 17 * 1 + 99 * 2 + 23 * 3 + 45 * 4 + 67 * 5) % 103, 106]);
    assert.equal(code128Values("AB12").includes(99), false, "short mid run stays in set B");
    assert.ok(code128Values("AB123456CD").includes(99), "long run uses set C");
  });
  it("round trip: encode to SVG then decode", () => {
    const samples = ["PJJ123C", "123456", "1234567", "A1", "SKU-00123", "FS4066DEN", "AB123456CD", "0001", "12", "1", "Hello World ~!", "9".repeat(20), "A".repeat(40), "VN8934567890128", "00012345678905", "4066", "4066-XL"];
    for (const t of samples) { const bars = encodeBarcode(t); assert.ok(bars, t); assert.equal(decodeCode128(barcodeSvg(bars)), t, t); }
  });
  it("round trip over a pseudo-random corpus", () => {
    let seed = 12345; const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
    const alpha = "0123456789012345678901234567890ABCDEFGHxyz-_./ ";
    for (let n = 0; n < 400; n++) { const len = 1 + Math.floor(rnd() * 24); let t = ""; for (let i = 0; i < len; i++) t += alpha[Math.floor(rnd() * alpha.length)]; if (isValidEan13(t)) continue; const bars = encodeBarcode(t); assert.equal(decodeCode128(barcodeSvg(bars)), t, JSON.stringify(t)); }
  });
  it("widths sum to 11 modules per symbol plus 2 for the stop", () => { const w = code128Widths("ABC"); assert.equal(w.reduce((a, b) => a + b, 0), 11 * (1 + 3 + 1) + 13); });
  it("rejects non-ASCII and empty", () => { assert.equal(isCode128Encodable("Đen"), false); assert.equal(encodeBarcode("Đen"), null); assert.equal(encodeBarcode(""), null); assert.throws(() => code128Values("é")); });
});

describe("EAN-13", () => {
  it("check digits of known codes", () => {
    assert.equal(ean13CheckDigit("400638133393"), 1); // 4006381333931
    assert.equal(ean13CheckDigit("590123412345"), 7); // 5901234123457
    assert.equal(isValidEan13("4006381333931"), true);
    assert.equal(isValidEan13("5901234123457"), true);
    assert.equal(isValidEan13("5901234123458"), false);
    assert.equal(isValidEan13("590123412345"), false);
    assert.equal(isValidEan13("59012341234a7"), false);
  });
  it("bit pattern of 5901234123457 (published example)", () => {
    // first digit 5 -> parity LGGLLG; digits 9 0 1 2 3 4: L(9) G(0) G(1) L(2) L(3) G(4); right half R(5 7 ... )
    const b = ean13Bits("5901234123457");
    assert.equal(b.slice(0, 3), "101"); assert.equal(b.slice(3, 10), "0001011"); assert.equal(b.slice(10, 17), "0100111"); assert.equal(b.slice(17, 24), "0110011");
    assert.equal(b.slice(-10), "1000100" + "101"); // last digit 7 = R "1000100" then end guard
    assert.equal(ean13Bits("5901234123457").length, 95);
  });
  it("round trip: valid EAN-13 uses EAN, others fall back to Code128", () => {
    for (const t of ["4006381333931", "5901234123457", "8934563138165", "0000000000000", "9780201379624"]) { if (!isValidEan13(t)) continue; const bars = encodeBarcode(t); assert.equal(bars.kind, "EAN13"); assert.equal(decodeEan13(barcodeSvg(bars)), t); }
    // generate 300 valid EANs and decode them all
    let seed = 7; for (let n = 0; n < 300; n++) { let s = ""; for (let i = 0; i < 12; i++) { seed = (seed * 1103515245 + 12345) & 0x7fffffff; s += String(seed % 10); } const t = s + ean13CheckDigit(s); const bars = encodeBarcode(t); assert.equal(bars.kind, "EAN13"); assert.equal(decodeEan13(barcodeSvg(bars)), t); }
    const bad = encodeBarcode("5901234123458"); assert.equal(bad.kind, "CODE128"); assert.equal(decodeCode128(barcodeSvg(bad)), "5901234123458");
  });
});
