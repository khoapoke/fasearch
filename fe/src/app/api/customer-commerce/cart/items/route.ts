import type { NextRequest } from "next/server";
import { authError, readJsonObject, requireJsonPost } from "@/lib/server/customer-auth";
import { commerceUpstream } from "@/lib/server/customer-commerce";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const guard = requireJsonPost(request);
  if (guard) return guard;
  const parsed = await readJsonObject(request);
  if (!parsed.ok) return parsed.response;
  const skuId = parsed.body.skuId;
  const quantity = parsed.body.quantity;
  if (typeof skuId !== "number" || !Number.isSafeInteger(skuId) || skuId < 1) return authError("SKU chưa hợp lệ.", 400, "INVALID_SKU");
  if (typeof quantity !== "number" || !Number.isSafeInteger(quantity) || quantity < 1 || quantity > 999) return authError("Số lượng phải từ 1 đến 999.", 400, "INVALID_QUANTITY");
  return commerceUpstream(request, "/api/v1/cart/items", { method: "POST", body: { skuId, quantity }, safeErrors: true });
}
