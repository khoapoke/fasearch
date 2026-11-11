import type { NextRequest } from "next/server";
import { trashRestore } from "@/lib/server/admin-trash";

const KINDS = new Set(["products", "variants", "categories", "customers", "employees", "accounts"]);
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: NextRequest, { params }: { params: Promise<{ kind: string; id: string }> }) {
  const { kind, id } = await params;
  if (!KINDS.has(kind)) {
    return Response.json({ success: false, code: 400, message: "Loại dữ liệu thùng rác chưa hợp lệ.", result: null }, { status: 400 });
  }
  if (!/^[1-9]\d*$/.test(id) || !Number.isSafeInteger(Number(id))) {
    return Response.json({ success: false, code: 400, message: "Mã mục khôi phục chưa hợp lệ.", result: null }, { status: 400 });
  }
  return trashRestore(request, kind, Number(id));
}
