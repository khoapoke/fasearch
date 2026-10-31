import type { NextRequest } from "next/server";
import { requireJsonPost, authError, readJsonObject } from "@/lib/server/customer-auth";
import { catalogRead, catalogWrite } from "@/lib/server/admin-catalog";
export const dynamic = "force-dynamic"; export const runtime = "nodejs";
export async function GET(request: NextRequest) { return catalogRead(request, "/api/v1/categories"); }
export async function POST(request: NextRequest) {
  const guard = requireJsonPost(request); if (guard) return guard;
  const parsed = await readJsonObject(request); if (!parsed.ok) return parsed.response;
  const name = typeof parsed.body.categoryName === "string" ? parsed.body.categoryName.trim() : "";
  if (!name || name.length > 150) return authError("Tên danh mục phải từ 1 đến 150 ký tự.", 400);
  return catalogWrite(request, "/api/v1/categories", "POST", { categoryName: name });
}
