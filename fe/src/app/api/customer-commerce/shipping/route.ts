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
  const province = typeof parsed.body.province === "string" ? parsed.body.province.trim() : "";
  const district = typeof parsed.body.district === "string" ? parsed.body.district.trim() : "";
  const totalWeightGram = parsed.body.totalWeightGram;
  if (!province || province.length > 100 || !district || district.length > 100) return authError("Tỉnh/quận chưa hợp lệ.", 400, "INVALID_SHIPPING_ADDRESS");
  if (typeof totalWeightGram !== "number" || !Number.isInteger(totalWeightGram) || totalWeightGram < 1 || totalWeightGram > 100000) return authError("Tổng trọng lượng chưa hợp lệ.", 400, "INVALID_WEIGHT");
  return commerceUpstream(request, "/api/v1/orders/calculate-shipping-fee", { method: "POST", body: { province, district, totalWeightGram } });
}
