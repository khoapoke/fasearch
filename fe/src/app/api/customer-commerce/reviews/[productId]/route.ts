import type { NextRequest } from "next/server";
import { authError, readJsonObject, requireJsonPost } from "@/lib/server/customer-auth";
import { parseReviewBody, reviewProductId, reviewUpstream } from "@/lib/server/customer-reviews";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Ctx = { params: Promise<{ productId: string }> };

async function pid(ctx: Ctx): Promise<number | null> {
  return reviewProductId((await ctx.params).productId);
}

export async function GET(request: NextRequest, ctx: Ctx) {
  const id = await pid(ctx);
  if (!id) return authError("Mã sản phẩm chưa hợp lệ.", 400, "INVALID_PRODUCT");
  const sp = request.nextUrl.searchParams;
  const query = new URLSearchParams();
  const rating = sp.get("rating");
  if (rating && /^[1-5]$/.test(rating)) query.set("rating", rating);
  const sort = sp.get("sort");
  if (sort && ["newest", "rating_desc", "rating_asc"].includes(sort)) query.set("sort", sort);
  const page = sp.get("page");
  if (page && /^\d{1,4}$/.test(page)) query.set("page", page);
  const size = sp.get("size");
  if (size && /^\d{1,2}$/.test(size) && Number(size) >= 1 && Number(size) <= 50) query.set("size", size);
  const q = query.toString();
  return reviewUpstream(request, `/api/v1/reviews/products/${id}${q ? `?${q}` : ""}`);
}

async function write(request: NextRequest, ctx: Ctx, method: "POST" | "PUT") {
  const guard = requireJsonPost(request);
  if (guard) return guard;
  const id = await pid(ctx);
  if (!id) return authError("Mã sản phẩm chưa hợp lệ.", 400, "INVALID_PRODUCT");
  const parsed = await readJsonObject(request);
  if (!parsed.ok) return parsed.response;
  const checked = parseReviewBody(parsed.body);
  if (!checked.ok) return authError(checked.message, 400, "INVALID_REVIEW");
  return reviewUpstream(request, `/api/v1/reviews/products/${id}`, { method, body: checked.value, auth: "required" });
}

export const POST = (request: NextRequest, ctx: Ctx) => write(request, ctx, "POST");
export const PUT = (request: NextRequest, ctx: Ctx) => write(request, ctx, "PUT");

export async function DELETE(request: NextRequest, ctx: Ctx) {
  const guard = requireJsonPost(request);
  if (guard) return guard;
  const id = await pid(ctx);
  if (!id) return authError("Mã sản phẩm chưa hợp lệ.", 400, "INVALID_PRODUCT");
  return reviewUpstream(request, `/api/v1/reviews/products/${id}`, { method: "DELETE", auth: "required" });
}
