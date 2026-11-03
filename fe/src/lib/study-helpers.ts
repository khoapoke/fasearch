/**
 * R8 pure helpers for the interactive study controls (no React/DOM).
 * Small enough to unit-test directly; components consume them verbatim so
 * the tested contract is the shipped behavior.
 */

export type PriceBounds = { lo: number | null; hi: number | null };

/** Identity of a radio option list. Equal counts with different members
 *  (bap->[Tất cả,BAPE] vs adi->[Tất cả,Adidas]) MUST differ — this is the
 *  R8-F-R7-GHOST regression key. */
export function optionFingerprint(keys: Array<string | number | null | undefined>): string {
  return keys.map((k) => (k === null || k === undefined ? "?" : String(k))).join("|");
}

/** R8-F-R7-PREVIEW: default label only when truly idle (no committed bound)
 *  AND the draft sits exactly on the full extent. Any live drag/keyboard
 *  deviation shows draft values; cancel restores the default. */
export function shouldShowDefault(
  value: PriceBounds,
  draft: readonly [number, number] | null,
  min: number,
  max: number,
): boolean {
  if (value.lo !== null || value.hi !== null) return false;
  const d = draft ?? [min, max];
  return d[0] === min && d[1] === max;
}

export const PRICE_STEP = 50000;

/** R8: clamp ONLY the active thumb; the other handle keeps its exact value
 *  (500001/1000001 must survive moving the other end). Cross → active stops
 *  at the other handle, never pushes it. */
export function clampThumb(
  next: readonly [number, number],
  active: 0 | 1,
  min: number,
  max: number,
  step = PRICE_STEP,
): [number, number] {
  let [a, b] = next;
  const q = (v: number) => Math.min(Math.max(Math.round(v / step) * step, min), max);
  if (active === 0) a = q(a);
  else b = q(b);
  if (a > b) {
    if (active === 0) a = b;
    else b = a;
  }
  return [a, b];
}

/** Parse one exact price field. Blank = intentional unbounded (null).
 *  Rejects letters, minus, decimals, unsafe-huge — never silently converts. */
/** Parse/validate live in "@/lib/study-price" (single source of truth, tested there).
 *  This module adds only the R8 interaction contracts. */
