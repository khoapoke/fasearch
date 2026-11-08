import type { NextRequest } from "next/server";
import { trashRead } from "@/lib/server/admin-trash";

const KINDS = new Set(["products", "variants", "categories", "customers", "employees", "accounts"]);
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest, { params }: { params: Promise<{ kind: string }> }) {
  const { kind } = await params;
  if (!KINDS.has(kind)) {
    return Response.json({ success: false, code: 400, message: "Loại dữ liệu thùng rác chưa hợp lệ.", result: null }, { status: 400 });
  }
  const page = Math.max(0, Number(request.nextUrl.searchParams.get("page") ?? "0") || 0);
  const size = Math.min(50, Math.max(1, Number(request.nextUrl.searchParams.get("size") ?? "20") || 20));
  return trashRead(request, kind, `page=${page}&size=${size}`);
}
