import type { NextRequest } from "next/server";
import { authError, readJsonObject, requireJsonPost } from "@/lib/server/customer-auth";
import { commerceId, commerceUpstream } from "@/lib/server/customer-commerce";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function PUT(request: NextRequest, context: { params: Promise<{ skuId: string }> }) {
  const guard = requireJsonPost(request);
  if (guard) return guard;
  const { skuId: raw } = await context.params;
  const skuId = commerceId(raw);
  if (skuId === null) return authError("SKU chưa hợp lệ.", 400, "INVALID_SKU");
  const parsed = await readJsonObject(request);
  if (!parsed.ok) return parsed.response;
  const quantity = parsed.body.quantity;
  if (typeof quantity !== "number" || !Number.isSafeInteger(quantity) || quantity < 1 || quantity > 999) return authError("Số lượng phải từ 1 đến 999.", 400, "INVALID_QUANTITY");
  return commerceUpstream(request, `/api/v1/cart/items/${skuId}`, { method: "PUT", body: { quantity } });
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ skuId: string }> }) {
  const guard = requireJsonPost(request);
  if (guard) return guard;
  const { skuId: raw } = await context.params;
  const skuId = commerceId(raw);
  if (skuId === null) return authError("SKU chưa hợp lệ.", 400, "INVALID_SKU");
  return commerceUpstream(request, `/api/v1/cart/items/${skuId}`, { method: "DELETE" });
}
