import type { NextRequest } from "next/server";
import { requireJsonPost, authError, readJsonObject } from "@/lib/server/customer-auth";
import { catalogRead, catalogWrite, catalogDeleteWithReason, idOf } from "@/lib/server/admin-catalog";
export const dynamic = "force-dynamic"; export const runtime = "nodejs";
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) { const { id } = await params; const n = idOf(id); return n ? catalogRead(request, `/api/v1/products/variants/${n}`) : authError("SKU chưa hợp lệ.", 400); }
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = requireJsonPost(request); if (guard) return guard;
  const { id } = await params; const n = idOf(id); if (!n) return authError("SKU chưa hợp lệ.", 400);
  const parsed = await readJsonObject(request); if (!parsed.ok) return parsed.response;
  const b = parsed.body; const body: Record<string, unknown> = {};
  for (const k of ["color", "size", "barcode"] as const) if (typeof b[k] === "string") { const v = b[k].trim(); if (v.length > (k === "barcode" ? 100 : 50)) return authError(`${k} quá dài.`, 400); body[k] = v; }
  if (!Object.keys(body).length) return authError("Không có trường SKU để cập nhật.", 400);
  return catalogWrite(request, `/api/v1/products/variants/${n}`, "PATCH", body);
}
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) { const { id } = await params; const n = idOf(id); return n ? catalogDeleteWithReason(request, `/api/v1/products/variants/${n}`) : authError("SKU chưa hợp lệ.", 400); }
