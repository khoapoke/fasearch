import type { NextRequest } from "next/server";
import { readBoundedJsonObject } from "@/lib/server/bounded-json";
import { requireJsonPost } from "@/lib/server/customer-auth";
import { adminIdentity, adminRead } from "@/lib/server/admin-bff";
import { commerceUpstream } from "@/lib/server/customer-commerce";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ path: string[] }> };
const valid = (path: string[], write: boolean) => new RegExp(write ? "^[1-9][0-9]*/(decision|receive|refund)$" : "^[1-9][0-9]*(/photos/[0-2])?$").test(path.join("/"));
export async function GET(request: NextRequest, context: Context) {
  const { path } = await context.params;
  if (!valid(path, false)) return Response.json({ message: "Đường dẫn không hợp lệ." }, { status: 400 });
  return adminRead(request, `/api/v1/admin/returns/${path.join("/")}`);
}
export async function POST(request: NextRequest, context: Context) {
  const rejected = requireJsonPost(request); if (rejected) return rejected;
  const { path } = await context.params;
  if (!valid(path, true)) return Response.json({ message: "Đường dẫn không hợp lệ." }, { status: 400 });
  const who = await adminIdentity(request); if ("response" in who) return who.response;
  const parsed = await readBoundedJsonObject(request, 16 * 1024);
  if (!parsed.ok) return Response.json({ message: "Nội dung không hợp lệ hoặc quá lớn." }, { status: parsed.reason === "TOO_LARGE" ? 413 : 400 });
  try { return commerceUpstream(request, `/api/v1/admin/returns/${path.join("/")}`, { method: "POST", body: parsed.body, safeErrors: true, businessErrors: true }); }
  catch { return Response.json({ message: "Nội dung không hợp lệ." }, { status: 400 }); }
}
