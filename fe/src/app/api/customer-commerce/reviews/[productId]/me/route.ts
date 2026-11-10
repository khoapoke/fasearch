import type { NextRequest } from "next/server";
import { authError } from "@/lib/server/customer-auth";
import { reviewProductId, reviewUpstream } from "@/lib/server/customer-reviews";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest, ctx: { params: Promise<{ productId: string }> }) {
  const id = reviewProductId((await ctx.params).productId);
  if (!id) return authError("Mã sản phẩm chưa hợp lệ.", 400, "INVALID_PRODUCT");
  return reviewUpstream(request, `/api/v1/reviews/products/${id}/me`, { method: "GET", auth: "required" });
}
