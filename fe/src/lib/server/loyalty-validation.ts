function positiveMoney(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0 && value < 1e17
    && Math.abs(value * 100 - Math.round(value * 100)) < 1e-7;
}

export function policyBody(body: Record<string, unknown>, create: boolean): Record<string, unknown> | null {
  const { earnCurrencyPerPoint, redeemCurrencyPerPoint, status, version } = body;
  if (!positiveMoney(earnCurrencyPerPoint) || !positiveMoney(redeemCurrencyPerPoint)) return null;
  if (status !== undefined && status !== "ENABLED" && status !== "DISABLED") return null;
  if (!create && (!Number.isSafeInteger(version) || (version as number) < 1)) return null;
  return {
    earnCurrencyPerPoint,
    redeemCurrencyPerPoint,
    status: status ?? "DISABLED",
    ...(!create ? { version } : {}),
  };
}

export function tierBody(body: Record<string, unknown>): Record<string, unknown> | null {
  if (!Number.isSafeInteger(body.version) || (body.version as number) < 1) return null;
  const amount = body.minimumCumulativePaidSales;
  if (typeof amount !== "number" || !Number.isFinite(amount) || amount < 0 || amount >= 1e17
    || Math.abs(amount * 100 - Math.round(amount * 100)) >= 1e-7) return null;
  return { version: body.version, minimumCumulativePaidSales: amount };
}

export function positiveId(raw: string): number | null {
  if (!/^[1-9]\d*$/.test(raw)) return null;
  const value = Number(raw);
  return Number.isSafeInteger(value) ? value : null;
}
