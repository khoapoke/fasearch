// Deterministic AI page fixtures — nguồn ảnh/credit lấy nguyên từ frozen
// 6fdbcee references/customer-source/app.js (PHOTO/SEARCH_EXAMPLES). Chỉ dùng
// cho idle examples và ?preview= (mock); không phải kết quả AI thật, không có
// productId/giá/tồn kho.

export type AiPhoto = {
  src: string;
  page: string;
  author: string;
  alt: string;
};

export const AI_PHOTOS: Record<string, AiPhoto> = {
  // Ảnh kết quả "Áo khoác đen" đúng aiResults() 6fdbcee (bomber jacket).
  editorial: {
    src: "https://images.unsplash.com/photo-1554201277-9e2c0d5bcd39?auto=format&fit=max&w=1400&q=85",
    page: "https://unsplash.com/photos/man-wearing-cap-and-black-jacket-rmDr5FyXa5k",
    author: "Joel Barwick",
    alt: "Người mẫu mặc áo khoác đen trong ảnh thời trang đường phố minh họa",
  },
  teeModel: {
    src: "https://images.unsplash.com/photo-1768696082704-c4e5593d9f27?auto=format&fit=max&w=1100&q=85",
    page: "https://unsplash.com/photos/young-man-wearing-black-t-shirt-and-jeans-q8G7D_in-0Y",
    author: "otabek xatipov",
    alt: "Người mẫu mặc áo thun đen và quần jeans trong ảnh minh họa",
  },
  teeFlatlay: {
    src: "https://images.unsplash.com/photo-1620799139507-2a76f79a2f4d?auto=format&fit=max&w=1100&q=85",
    page: "https://unsplash.com/photos/white-crew-neck-t-shirt-elbKS4DY21g",
    author: "Mediamodifier",
    alt: "Áo thun trắng cổ tròn chụp kiểu flat lay",
  },
  teeWoman: {
    src: "https://images.unsplash.com/photo-1624533523809-3d27d9ea6d80?auto=format&fit=max&w=1100&q=85",
    page: "https://unsplash.com/photos/woman-in-white-crew-neck-t-shirt-smiling-LwQ_vWhCTo0",
    author: "Aditya Sharma",
    alt: "Người mẫu mặc áo sáng màu trong ảnh minh họa",
  },
};

export type AiExample = {
  id: string;
  photo: keyof typeof AI_PHOTOS;
  title: string;
  query: string;
  layout: "example-main" | "example-flatlay" | "example-portrait";
};

export const AI_EXAMPLES: AiExample[] = [
  { id: "black-tee", photo: "teeModel", title: "Áo thun đen", query: "Áo thun đen, dáng rộng, phối quần jeans", layout: "example-main" },
  { id: "white-tee", photo: "teeFlatlay", title: "Áo thun trắng", query: "Áo thun trắng trơn, cổ tròn", layout: "example-flatlay" },
  { id: "light-outfit", photo: "teeWoman", title: "Trang phục sáng màu", query: "Áo màu trắng, dáng rộng", layout: "example-portrait" },
];

export const AI_MODE_HINTS = {
  text: "Mô tả món đồ bằng vài từ — ví dụ màu và dáng.",
  image: "Chọn một ảnh JPG hoặc PNG làm tham chiếu.",
  composed: "Chọn ảnh tham chiếu, rồi thêm vài từ để thu hẹp.",
} as const;

export type PreviewState =
  | "idle"
  | "pending"
  | "results"
  | "empty"
  | "error"
  | "session"
  | "forbidden"
  | "imagefail";

export const PREVIEW_STATES: PreviewState[] = [
  "idle",
  "pending",
  "results",
  "empty",
  "error",
  "session",
  "forbidden",
  "imagefail",
];

export function normalizePreview(raw: string | string[] | undefined): PreviewState | null {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return value && (PREVIEW_STATES as string[]).includes(value) ? (value as PreviewState) : null;
}

export type MockResult = {
  sourceId: string;
  score: number;
  title: string;
  fileName: string;
  photo: keyof typeof AI_PHOTOS;
};

// Kết quả mẫu cố định cho review trạng thái; ảnh minh họa, không phải catalog.
export const MOCK_RESULTS: MockResult[] = [
  { sourceId: "mau-018-452", score: 0.873, title: "Áo khoác đen", fileName: "editorial-018.jpg", photo: "editorial" },
  { sourceId: "mau-009-004", score: 0.812, title: "Áo thun trắng", fileName: "tee-flatlay-009.jpg", photo: "teeFlatlay" },
];
