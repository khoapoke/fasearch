import { catalogUpstream } from "@/lib/catalog-upstream";

export const dynamic = "force-dynamic";

/** Logo hãng thật từ BE candidate (SVG đã kiểm định phía BE); FE chỉ chuyển tiếp. */
export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 64) {
    return Response.json({ success: false, code: 400, message: "Mã thương hiệu chưa hợp lệ.", result: null }, { status: 400 });
  }
  const upstream = await catalogUpstream(`/api/v1/brands/${slug}/logo`).catch(() => null);
  if (!upstream || !upstream.ok) {
    return Response.json({ success: false, code: upstream?.status ?? 502, message: "Không tải được logo.", result: null }, { status: upstream?.status ?? 502 });
  }
  return new Response(upstream.body, { status: 200, headers: { "content-type": upstream.headers.get("content-type") ?? "image/svg+xml", "cache-control": "public, max-age=3600" } });
}
