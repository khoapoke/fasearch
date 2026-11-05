// Ưu đãi công khai đang mở (GET /api/v1/promotions).
// Chỉ hiển thị đúng trường BE trả về; trường nào không có thì không suy diễn.

export type PublicOffer = {
  campaignId: number;
  title: string;
  discountType: string;
  discountValue: number;
  conditionText: string | null;
  startAt: string | null;
  endAt: string | null;
  code: string;
};

export type OffersResult = { offers: PublicOffer[]; rawCount: number };

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function finite(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function normalizePublicOffer(raw: unknown): PublicOffer | null {
  if (!raw || typeof raw !== "object") return null;
  const item = raw as Record<string, unknown>;
  const campaignId = finite(item.campaignId);
  const code = text(item.code);
  const title = text(item.title);
  const discountValue = finite(item.discountValue);
  if (campaignId === null || !Number.isInteger(campaignId) || campaignId < 1) return null;
  if (!code || !title || discountValue === null) return null;
  return {
    campaignId,
    title,
    code,
    discountType: text(item.discountType) ?? "",
    discountValue,
    conditionText: text(item.conditionText),
    startAt: text(item.startAt),
    endAt: text(item.endAt),
  };
}

export function normalizeOffers(raw: unknown): OffersResult {
  const list = Array.isArray(raw) ? raw : [];
  const offers = list.map(normalizePublicOffer).filter((offer): offer is PublicOffer => offer !== null);
  return { offers, rawCount: list.length };
}

/** Nhãn giảm giá chỉ dựa trên discountType BE trả về. */
export function offerDiscountLabel(offer: PublicOffer): string {
  if (offer.discountType === "FREE_SHIP") return "Miễn phí giao hàng";
  if (offer.discountType === "PHAN_TRAM") return `Giảm ${offer.discountValue}%`;
  if (offer.discountType === "SO_TIEN") return `Giảm ${offer.discountValue.toLocaleString("vi-VN")} ₫`;
  return "Ưu đãi đang mở";
}

/** "dd/MM/yyyy" từ chuỗi ISO BE trả về; không bịa ngày nếu thiếu. */
export function offerValidityLabel(offer: PublicOffer): string | null {
  const end = offer.endAt ? new Date(offer.endAt) : null;
  if (!end || Number.isNaN(end.getTime())) return null;
  return `Đến ${end.toLocaleDateString("vi-VN")}`;
}
