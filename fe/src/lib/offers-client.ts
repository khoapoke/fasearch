"use client";

import { normalizeOffers, type OffersResult } from "./offers";

export class OffersError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

/** Danh sách ưu đãi công khai — không cần đăng nhập, không cache. */
export async function fetchPublicOffers(signal?: AbortSignal): Promise<OffersResult> {
  const response = await fetch("/api/customer-commerce/offers", { cache: "no-store", signal });
  const payload = (await response.json().catch(() => null)) as { success?: boolean; message?: string; result?: unknown } | null;
  if (!response.ok || payload?.success !== true) {
    throw new OffersError(payload?.message || "Không tải được ưu đãi đang mở.", response.status || 502);
  }
  return normalizeOffers(payload.result);
}
