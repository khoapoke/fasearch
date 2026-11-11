// Deliberate color x size SKU generation.
//
// Pure helper so it is unit-testable without a browser or backend.
// - Normalizes color/size (trim; empty becomes null).
// - Skips combinations already present in existing variants (case-insensitive).
// - Rejects duplicate combinations inside the request itself.
// - Never invents stock or barcodes; leaves them to the server/defaults.

export type SkuInput = { color: string | null; size: string | null };
export type ExistingVariant = { color: string | null; size: string | null };

function norm(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function key(color: string | null, size: string | null): string {
  return `${(color ?? "").toLowerCase()}|${(size ?? "").toLowerCase()}`;
}

export function buildSkuCombinations(
  colors: Array<string | null | undefined>,
  sizes: Array<string | null | undefined>,
  existing: ExistingVariant[],
): { combinations: SkuInput[]; skippedDuplicate: number } {
  const seen = new Set(existing.map((v) => key(norm(v.color), norm(v.size))));
  const combinations: SkuInput[] = [];
  let skippedDuplicate = 0;
  const colorList = [...new Set(colors.map(norm))];
  const sizeList = [...new Set(sizes.map(norm))];
  for (const color of colorList) {
    for (const size of sizeList) {
      if (color === null && size === null) continue;
      const k = key(color, size);
      if (seen.has(k)) {
        skippedDuplicate += 1;
        continue;
      }
      seen.add(k);
      combinations.push({ color, size });
    }
  }
  return { combinations, skippedDuplicate };
}
