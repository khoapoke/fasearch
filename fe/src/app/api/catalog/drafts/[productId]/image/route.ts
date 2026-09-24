import type { NextRequest } from "next/server";
import { forwardSessionRequest } from "@/lib/server/session-proxy";

export const runtime = "nodejs";

const maxImageBytes = 10 * 1024 * 1024;

export async function GET(
  request: NextRequest,
  context: RouteContext<"/api/catalog/drafts/[productId]/image">,
) {
  const { productId } = await context.params;
  return forwardSessionRequest(request,
    `/api/v1/catalog/admin/drafts/${encodeURIComponent(productId)}/image`, "GET");
}

export async function POST(
  request: NextRequest,
  context: RouteContext<"/api/catalog/drafts/[productId]/image">,
) {
  const declaredLength = Number(request.headers.get("content-length") ?? "0");
  if (declaredLength > maxImageBytes + 1024 * 1024) {
    return Response.json({ code: "IMAGE_TOO_LARGE" }, { status: 413 });
  }
  let input: FormData;
  try {
    input = await request.formData();
  } catch {
    return Response.json({ code: "INVALID_REQUEST" }, { status: 400 });
  }
  const image = input.get("image");
  const expectedVersion = input.get("expected_version_no");
  if (!(image instanceof File) || image.size === 0
      || typeof expectedVersion !== "string"
      || !/^[1-9]\d*$/.test(expectedVersion)) {
    return Response.json({ code: "INVALID_REQUEST" }, { status: 400 });
  }
  if (image.size > maxImageBytes) {
    return Response.json({ code: "IMAGE_TOO_LARGE" }, { status: 413 });
  }
  const outbound = new FormData();
  outbound.set("image", image);
  outbound.set("expected_version_no", expectedVersion);
  const { productId } = await context.params;
  return forwardSessionRequest(request,
    `/api/v1/catalog/admin/drafts/${encodeURIComponent(productId)}/image`,
    "POST", outbound);
}
