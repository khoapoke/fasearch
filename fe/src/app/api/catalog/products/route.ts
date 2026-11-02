import { catalogUpstream, jsonError, readJson, resolveCatalogImage } from "@/lib/catalog-upstream";

export const dynamic = "force-dynamic";

const SORTS = new Set(["id,desc", "id,asc", "price,asc", "price,desc", "productName,asc", "productName,desc"]);

function intInRange(raw: string | null, min: number, max: number): number | null {
  if (raw === null || raw === "") return null;
  const n = Number(raw);
  return Number.isInteger(n) && n >= min && n <= max ? n : null;
}

function decimalOrNull(raw: string | null): number | null {
  if (raw === null || raw === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const keyword = (url.searchParams.get("keyword") ?? "").trim();
  if ([...keyword].length > 200) return jsonError("Từ khóa tối đa 200 ký tự.", 400);

  const categoryIdRaw = url.searchParams.get("categoryId");
  const categoryId = categoryIdRaw ? intInRange(categoryIdRaw, 1, Number.MAX_SAFE_INTEGER) : null;
  if (categoryIdRaw && categoryId === null) return jsonError("Danh mục chưa hợp lệ.", 400);
  const brandRaw = (url.searchParams.get("brand") ?? "").trim();
  const brand = /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(brandRaw) && brandRaw.length <= 64 ? brandRaw : null;
  if (url.searchParams.get("brand") && brand === null) return jsonError("Thương hiệu chưa hợp lệ.", 400);
  const minPrice = decimalOrNull(url.searchParams.get("minPrice"));
  const maxPrice = decimalOrNull(url.searchParams.get("maxPrice"));
  if (minPrice !== null && maxPrice !== null && minPrice > maxPrice) {
    return jsonError("Khoảng giá chưa hợp lệ.", 400);
  }
  const page = intInRange(url.searchParams.get("page"), 0, 10000) ?? 0;
  const size = intInRange(url.searchParams.get("size"), 1, 24) ?? 6;
  const sortRaw = url.searchParams.get("sort") ?? "id,desc";
  const sort = SORTS.has(sortRaw) ? sortRaw : "id,desc";

  const params = new URLSearchParams({
    page: String(page),
    size: String(size),
    sort,
    status: "ACTIVE",
  });
  if (keyword) params.set("keyword", keyword);
  if (brand) params.set("brand", brand);
  if (categoryId !== null) params.set("categoryId", String(categoryId));
  if (minPrice !== null) params.set("minPrice", String(minPrice));
  if (maxPrice !== null) params.set("maxPrice", String(maxPrice));

  try {
    const upstream = await catalogUpstream("/api/v1/products", params);
    const payload = (await readJson(upstream)) as {
      success?: boolean;
      message?: string;
      result?: { content?: Array<Record<string, unknown>> };
    } | null;
    if (!upstream.ok || !payload?.success || !payload.result) {
      return Response.json(
        payload ?? { success: false, code: upstream.status, message: "Không tải được sản phẩm.", result: null },
        { status: upstream.status || 502 },
      );
    }
    const content = Array.isArray(payload.result.content) ? payload.result.content : [];
    return Response.json(
      {
        ...payload,
        result: {
          ...payload.result,
          content: content.map((item) => ({ ...item, imageUrl: resolveCatalogImage(item.imageUrl) })),
        },
      },
      { status: upstream.status },
    );
  } catch {
    return jsonError("Không kết nối được máy chủ danh mục.", 503);
  }
}
