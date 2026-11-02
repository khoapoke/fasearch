// Ranh giới dữ liệu của Home (Home A r2 static slice).
//
// Mục đích: component Home chỉ tiêu thụ MỘT view model ổn định, bất kể dữ liệu
// đến từ catalog thật (BE) hay từ fixture minh họa. Nhờ vậy:
//   - fixture không bao giờ trộn vào kết quả shop/AI thật;
//   - trạng thái loading/empty/error/partial/ready phân biệt được (A2);
//   - ánh xạ trạng thái là hàm thuần, test được bằng node:test (không thêm framework).
//
// Fixture ở đây là MINH HỌA: một áo bomber 549.000 ₫ trong bản thiết kế đã được
// duyệt (nguồn 6fdbcee), không phải mã sản phẩm thật và không phải giá bán.

/** Ảnh dùng ở Home — giữ nguyên ảnh/credit của bản thiết kế đã duyệt. */
export type HomePhoto = {
  src: string;
  alt: string;
  author: string;
  page: string;
  /** Cho biết ảnh đến từ đâu, hiển thị cạnh credit. */
  sourceLabel: string;
};

const UNSPLASH = "?auto=format&fit=max&w=1100&q=85";

export const HOME_PHOTOS: Record<"hero" | "bomber", HomePhoto> = {
  // Ảnh hero của bản đã duyệt (p23-a-refine-r2 · PHOTO.homeHero = teeModel).
  hero: {
    src: `https://images.unsplash.com/photo-1768696082704-c4e5593d9f27${UNSPLASH}`,
    alt: "Người mẫu mặc áo thun đen và quần jeans trong ảnh minh họa",
    author: "otabek xatipov",
    page: "https://unsplash.com/photos/young-man-wearing-black-t-shirt-and-jeans-q8G7D_in-0Y",
    sourceLabel: "Unsplash",
  },
  // Ảnh bomber của demo đã duyệt (PHOTO.jacketBomber).
  bomber: {
    src: `https://images.unsplash.com/photo-1702026672242-c79a52996dd4${UNSPLASH}`,
    alt: "Áo khoác bomber tối màu treo trên móc (ảnh gốc còn một áo khác phía dưới)",
    author: "nens love",
    page: "https://unsplash.com/photos/a-black-jacket-hanging-on-a-wall-next-to-a-white-chair-3S1feeK3ZJA",
    sourceLabel: "Unsplash",
  },
};

/** Bước của demo tích hợp (ba bước, chuyển tay, nội dung tĩnh). */
export type HomeDemoStep = "describe" | "suggest" | "explore";

export const HOME_DEMO_STEPS: Array<{ id: HomeDemoStep; index: string; label: string }> = [
  { id: "describe", index: "01", label: "Mô tả" },
  { id: "suggest", index: "02", label: "Gợi ý" },
  { id: "explore", index: "03", label: "Xem món đồ" },
];

/**
 * Fixture minh họa của demo. Mọi giá trị ở đây là MINH HỌA — không phải sản phẩm
 * thật, không phải giá bán, không có mã catalog. Xem `HOME_DEMO.disclosure`.
 */
export const HOME_DEMO = {
  query: "Áo khoác đen minimal, hợp đi chơi mùa đông.",
  tags: [
    { label: "Danh mục", value: "Áo khoác" },
    { label: "Màu", value: "Đen" },
  ],
  product: {
    name: "Áo khoác đen",
    subtitle: "Dáng bomber · Khóa kéo",
    overline: "Áo khoác",
    /** Chuỗi đã định dạng sẵn — Home không tự tính hay làm tròn tiền. */
    priceLabel: "549.000 ₫",
    photo: HOME_PHOTOS.bomber,
  },
  disclosure:
    "Ví dụ minh họa từ bản thiết kế: một áo bomber trong danh mục mẫu, không phải sản phẩm đang bán. "
    + "Không có mã sản phẩm, không phải giá bán và không thể đặt mua.",
} as const;

/** Sản phẩm catalog thật, đã chuẩn hóa cho lưới sản phẩm của Home. */
export type HomeProduct = {
  id: number;
  name: string;
  price: number;
  image?: string;
  href: string;
};

export type HomeCategory = { id: number; name: string };

/**
 * Trạng thái khám phá của Home. `partial` = một nguồn sống, một nguồn lỗi — phải
 * hiển thị được mà không thay lỗi thật bằng dữ liệu bán trông hợp lý.
 */
export type HomeDiscovery =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "partial"; categories: HomeCategory[]; productError: string }
  | { status: "empty"; categories: HomeCategory[] }
  | { status: "ready"; categories: HomeCategory[]; products: HomeProduct[]; total: number };

export type HomeDiscoveryInput = {
  categories: HomeCategory[] | null;
  categoriesError: string | null;
  products: HomeProduct[] | null;
  productsTotal: number | null;
  productsError: string | null;
};

/**
 * Ánh xạ kết quả hai nguồn (danh mục + sản phẩm) sang MỘT trạng thái hiển thị.
 * Thuần, không phụ thuộc React/DOM — dùng cho test và cho component.
 */
export function homeDiscoveryState(input: HomeDiscoveryInput): HomeDiscovery {
  const { categories, categoriesError, products, productsTotal, productsError } = input;
  if (!categories && !categoriesError && !products && !productsError) return { status: "loading" };
  if (!categories && categoriesError && !products && !productsError) {
    return { status: "error", message: categoriesError };
  }
  const cats = categories ?? [];
  if (productsError) {
    if (categories && categories.length > 0) {
      return { status: "partial", categories: cats, productError: productsError };
    }
    return { status: "error", message: productsError };
  }
  if (products && products.length === 0) return { status: "empty", categories: cats };
  if (products) {
    return { status: "ready", categories: cats, products, total: productsTotal ?? products.length };
  }
  // Danh mục đã về nhưng sản phẩm còn đang tải: giữ trạng thái tải để không nhấp nháy.
  return { status: "loading" };
}


/**
 * Trạng thái minh họa theo MOTION-SPEC p23-r5 (home-a-r2):
 * dormant → typing → tags → processing → result → complete.
 * Chọn tay đưa thẳng về trạng thái tĩnh tương ứng, không chạy tiếp.
 */
export type DemoStage = "dormant" | "typing" | "tags" | "processing" | "result" | "complete" | "suggest";
