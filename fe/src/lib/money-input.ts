/**
 * Parsing for admin money inputs. Pure, so it can be tested with `node --test`.
 *
 * Vietnamese grouping uses dots (1.450.000) and the decimal mark is a comma, but
 * people also paste values such as 1450000.50. The rules keep both readable
 * without guessing:
 * - dots followed by exactly three digits, with a 1 to 3 digit head, are grouping;
 * - a single dot or comma followed by one or two digits is the decimal mark;
 * - when both appear, the last one must be the decimal mark;
 * - anything else is invalid and is never silently stripped.
 */

/** Value held by the parent when the typed text cannot be read. `Number()` of it is NaN. */
export const MONEY_INVALID = "invalid";

export type MoneyParse = { ok: true; value: string } | { ok: false };

const MAX_INTEGER_DIGITS = 12;

function canonical(integer: string, fraction: string): MoneyParse {
  const head = integer.replace(/^0+(?=\d)/, "");
  if (head.length > MAX_INTEGER_DIGITS) return { ok: false };
  const tail = fraction.replace(/0+$/, "");
  return { ok: true, value: tail ? `${head}.${tail}` : head };
}

const GROUPED = (sep: string) => new RegExp(`^[1-9]\\d{0,2}(?:\\${sep}\\d{3})+$`);

/** Returns the canonical numeric string ("1450000.5"), "" for blank, or ok:false. */
export function parseMoneyInput(text: string): MoneyParse {
  const raw = text.replace(/[\s ]/g, "");
  if (raw === "") return { ok: true, value: "" };
  if (!/^[\d.,]+$/.test(raw)) return { ok: false };
  if (/^\d+$/.test(raw)) return canonical(raw, "");

  const dots = (raw.match(/\./g) ?? []).length;
  const commas = (raw.match(/,/g) ?? []).length;

  if (commas === 0) {
    // Only dots.
    if (GROUPED(".").test(raw)) return canonical(raw.replace(/\./g, ""), "");
    const m = /^(\d+)\.(\d{1,2})$/.exec(raw);
    if (dots === 1 && m) return canonical(m[1], m[2]);
    return { ok: false };
  }
  if (commas > 1) return { ok: false };
  // Exactly one comma, which is the decimal mark.
  const m = /^([\d.]+),(\d{1,2})$/.exec(raw);
  if (!m) return { ok: false };
  const head = m[1];
  if (dots === 0) return canonical(head, m[2]);
  if (!GROUPED(".").test(head)) return { ok: false };
  return canonical(head.replace(/\./g, ""), m[2]);
}

/** Parent state for typed text: canonical string, "" or MONEY_INVALID. */
export function moneyState(text: string): string {
  const parsed = parseMoneyInput(text);
  return parsed.ok ? parsed.value : MONEY_INVALID;
}
