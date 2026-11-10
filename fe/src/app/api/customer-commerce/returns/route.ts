import type { NextRequest } from "next/server";
import { readBoundedJsonObject } from "@/lib/server/bounded-json";
import { requireJsonPost } from "@/lib/server/customer-auth";
import { commerceUpstream } from "@/lib/server/customer-commerce";
export const dynamic = "force-dynamic";
export async function POST(request: NextRequest) {
  const rejected = requireJsonPost(request); if (rejected) return rejected;
  const parsed = await readBoundedJsonObject(request, 22 * 1024 * 1024);
  if (!parsed.ok) return Response.json({ message: "Nội dung không hợp lệ hoặc quá lớn." }, { status: parsed.reason === "TOO_LARGE" ? 413 : 400 });
  try { return commerceUpstream(request, "/api/v1/returns", { method: "POST", body: parsed.body, safeErrors: true, businessErrors: true }); }
  catch { return Response.json({ message: "Nội dung không hợp lệ." }, { status: 400 }); }
}
