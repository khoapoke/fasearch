// Barcode encoders for label printing (pure logic, no dependencies).
// Code128 (sets B and C, with automatic switching) and EAN-13. Output is a list of module
// widths (bar, space, bar, ...), which renderers turn into SVG rects.

// Code128 patterns for values 0..105 plus the stop pattern (index 106), as bar/space widths.
// Cross-checked against the ZXing Code128Reader table (see tests/barcode.test.mjs).
const C128_PATTERNS =
  "212222,222122,222221,121223,121322,131222,122213,122312,132212,221213,221312,231212,112232,122132,122231,113222,123122,123221,223211,221132,221231,213212,223112,312131,311222,321122,321221,312212,322112,322211,212123,212321,232121,111323,131123,131321,112313,132113,132311,211313,231113,231311,112133,112331,132131,113123,113321,133121,313121,211331,231131,213113,213311,213131,311123,311321,331121,312113,312311,332111,314111,221411,431111,111224,111422,121124,121421,141122,141221,112214,112412,122114,122411,142112,142211,241211,221114,413111,241112,134111,111242,121142,121241,114212,124112,124211,411212,421112,421211,212141,214121,412121,111143,111341,131141,114113,114311,411113,411311,113141,114131,311141,411131,211412,211214,211232,2331112".split(",");

export const CODE128_PATTERNS: readonly string[] = C128_PATTERNS;
const START_B = 104, START_C = 105, CODE_C = 99, CODE_B = 100, STOP = 106;

/** Code128 can carry printable ASCII 32..126 here. */
export function isCode128Encodable(text: string): boolean {
  return text.length > 0 && text.length <= 40 && /^[\x20-\x7e]+$/.test(text);
}

/** Symbol values (start, data..., checksum, stop) for a Code128 string. */
export function code128Values(text: string): number[] {
  if (!isCode128Encodable(text)) throw new Error("Giá trị không mã hóa được thành Code128.");
  const values: number[] = [];
  let set: "B" | "C" | null = null;
  let i = 0;
  const digitRun = (from: number) => { let n = 0; while (from + n < text.length && text.charCodeAt(from + n) >= 48 && text.charCodeAt(from + n) <= 57) n++; return n; };
  while (i < text.length) {
    const run = digitRun(i);
    const atEnd = i + run === text.length;
    const useC = run >= 6 || (run >= 4 && (i === 0 || atEnd));
    if (useC) {
      let pairs = run;
      if (run % 2 === 1) {
        // Odd run: one digit in set B first (keeps pairs aligned to the end when the run ends the string).
        if (set === null) { values.push(START_B); set = "B"; }
        else if (set === "C") { values.push(CODE_B); set = "B"; }
        values.push(text.charCodeAt(i) - 32); i += 1; pairs -= 1;
      }
      if (set === null) { values.push(START_C); set = "C"; }
      else if (set === "B") { values.push(CODE_C); set = "C"; }
      for (let k = 0; k < pairs; k += 2) values.push(Number(text.slice(i + k, i + k + 2)));
      i += pairs;
    } else {
      if (set === null) { values.push(START_B); set = "B"; }
      else if (set === "C") { values.push(CODE_B); set = "B"; }
      values.push(text.charCodeAt(i) - 32); i += 1;
    }
  }
  let sum = values[0];
  for (let k = 1; k < values.length; k++) sum += values[k] * k;
  values.push(sum % 103, STOP);
  return values;
}

/** Module widths (bar first) for Code128, quiet zone not included. */
export function code128Widths(text: string): number[] {
  const out: number[] = [];
  for (const v of code128Values(text)) for (const ch of C128_PATTERNS[v]) out.push(Number(ch));
  return out;
}

// EAN-13
const EAN_L = ["0001101", "0011001", "0010011", "0111101", "0100011", "0110001", "0101111", "0111011", "0110111", "0001011"];
const EAN_G = ["0100111", "0110011", "0011011", "0100001", "0011101", "0111001", "0000101", "0010001", "0001001", "0010111"];
const EAN_R = ["1110010", "1100110", "1101100", "1000010", "1011100", "1001110", "1010000", "1000100", "1001000", "1110100"];
const EAN_PARITY = ["LLLLLL", "LLGLGG", "LLGGLG", "LLGGGL", "LGLLGG", "LGGLLG", "LGGGLL", "LGLGLG", "LGLGGL", "LGGLGL"];

export function ean13CheckDigit(first12: string): number {
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += Number(first12[i]) * (i % 2 === 0 ? 1 : 3);
  return (10 - (sum % 10)) % 10;
}

export function isValidEan13(text: string): boolean {
  return /^\d{13}$/.test(text) && ean13CheckDigit(text.slice(0, 12)) === Number(text[12]);
}

/** Module bits ("1" = bar) of an EAN-13 symbol: 95 modules, guards included. */
export function ean13Bits(text: string): string {
  if (!isValidEan13(text)) throw new Error("EAN-13 không hợp lệ.");
  const parity = EAN_PARITY[Number(text[0])];
  let bits = "101";
  for (let i = 0; i < 6; i++) bits += (parity[i] === "L" ? EAN_L : EAN_G)[Number(text[i + 1])];
  bits += "01010";
  for (let i = 0; i < 6; i++) bits += EAN_R[Number(text[i + 7])];
  return bits + "101";
}

export type BarcodeKind = "EAN13" | "CODE128";
export type BarcodeBars = { kind: BarcodeKind; text: string; bits: string };

/** Bits for any barcode text: EAN-13 when it is a valid 13-digit EAN, otherwise Code128. Null when neither can carry it. */
export function encodeBarcode(text: string): BarcodeBars | null {
  if (isValidEan13(text)) return { kind: "EAN13", text, bits: ean13Bits(text) };
  if (!isCode128Encodable(text)) return null;
  let bits = "";
  const w = code128Widths(text);
  w.forEach((n, idx) => { bits += (idx % 2 === 0 ? "1" : "0").repeat(n); });
  return { kind: "CODE128", text, bits };
}

/** Quiet zone in modules on each side. */
export const QUIET_MODULES = 10;

const escapeAttr = (v: string) => v.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Merged bar path in module units (viewBox "0 0 total 1") and the total width incl. quiet zones. */
export function barcodePath(bars: BarcodeBars, quiet = QUIET_MODULES): { d: string; total: number } {
  let d = "";
  let i = 0;
  while (i < bars.bits.length) {
    if (bars.bits[i] === "1") { let j = i; while (j < bars.bits.length && bars.bits[j] === "1") j++; d += `M${i + quiet} 0h${j - i}v1h-${j - i}z`; i = j; } else i++;
  }
  return { d, total: bars.bits.length + quiet * 2 };
}

/** Standalone SVG markup (stretches to its container; preserveAspectRatio none keeps bars crisp). */
export function barcodeSvg(bars: BarcodeBars, opts: { quiet?: number } = {}): string {
  const { d, total } = barcodePath(bars, opts.quiet ?? QUIET_MODULES);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${total} 1" preserveAspectRatio="none" shape-rendering="crispEdges" role="img" aria-label="Barcode ${escapeAttr(bars.text)}"><path fill="#000" d="${d}"/></svg>`;
}

export const barcodeModules = (bars: BarcodeBars, quiet = QUIET_MODULES) => bars.bits.length + quiet * 2;
