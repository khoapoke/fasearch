import type { NextRequest } from "next/server";
import { requireJsonPost } from "@/lib/server/customer-auth";
import { readBoundedJsonObject } from "@/lib/server/bounded-json";
import { commerceUpstream } from "@/lib/server/customer-commerce";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ path: string[] }> };
export async function GET(request: NextRequest, context: Context) {
  const { path } = await context.params;
  if (path.length !== 1 || !["preferences", "favorites"].includes(path[0])) return Response.json({ message: "Đường dẫn không hợp lệ." }, { status: 400 });
  return commerceUpstream(request, `/api/v1/notifications/${path[0]}`);
}
export async function PUT(request: NextRequest, context: Context) {
  const rejected = requireJsonPost(request); if (rejected) return rejected;
  const { path } = await context.params;
  const target = path.join("/");
  if (!/^(preferences|favorites\/[1-9][0-9]*)$/.test(target)) return Response.json({ message: "Đường dẫn không hợp lệ." }, { status: 400 });
  const parsed = await readBoundedJsonObject(request, 1024);
  if (!parsed.ok) return Response.json({ message: "Nội dung không hợp lệ hoặc quá lớn." }, { status: parsed.reason === "TOO_LARGE" ? 413 : 400 });
  const body = parsed.body;
  const valid = target === "preferences" ? typeof body.orderUpdates === "boolean" : typeof body.stockAlert === "boolean" && typeof body.priceAlert === "boolean";
  if (!valid) return Response.json({ message: "Tùy chọn thông báo phải là giá trị bật/tắt." }, { status: 400 });
  return commerceUpstream(request, `/api/v1/notifications/${target}`, { method: "PUT", body: target === "preferences" ? { orderUpdates: body.orderUpdates } : { stockAlert: body.stockAlert, priceAlert: body.priceAlert }, safeErrors: true });
}
