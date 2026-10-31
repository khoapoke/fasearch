// Explicit preview adapters for flows without a backend contract.
// Fixture shapes mirror the admin/product envelopes so a future data adapter
// can replace them without layout rewrites. Preview actions only mutate local
// fixture state — never a server mutation, payment, backup or AI call.

export type PreviewOrderItem = { name: string; meta: string; qty: number; price: number };

export type PreviewOrder = {
  id: string;
  date: string;
  status: "processing" | "shipping" | "done" | "cancelled";
  items: number;
  total: number;
  lines: PreviewOrderItem[];
};

export type PreviewAddress = {
  id: string;
  name: string;
  phone: string;
  address: string;
  isDefault: boolean;
};

export type PreviewAiEntry = {
  id: string;
  date: string;
  results: number;
  thumb: number;
};

export const PREVIEW_ORDERS: PreviewOrder[] = [
  {
    id: "FS-90214", date: "10/10/2026", status: "shipping", items: 3, total: 757000,
    lines: [
      { name: "Áo Thun Cotton Compact 220gsm", meta: "Màu Đen · Size L", qty: 1, price: 249000 },
      { name: "Quần Short Thể Thao 7 Inch", meta: "Màu Xám · Size L", qty: 2, price: 189000 },
      { name: "Tất Khử Mùi Nano Bạc (quà tặng)", meta: "Size Free", qty: 1, price: 0 },
    ],
  },
  {
    id: "FS-89877", date: "02/10/2026", status: "done", items: 2, total: 538000,
    lines: [
      { name: "Áo Polo Pique Cotton", meta: "Màu Trắng · Size XL", qty: 1, price: 349000 },
      { name: "Quần Short Thể Thao 7 Inch", meta: "Màu Xám · Size L", qty: 1, price: 189000 },
    ],
  },
  {
    id: "FS-89501", date: "24/09/2026", status: "done", items: 1, total: 249000,
    lines: [{ name: "Áo Thun Cotton Compact 220gsm", meta: "Màu Đen · Size L", qty: 1, price: 249000 }],
  },
];

export const PREVIEW_ADDRESSES: PreviewAddress[] = [
  { id: "a1", name: "Trần Quân Trị", phone: "090 123 4567", address: "12 Nguyễn Huệ, Bến Nghé, Quận 1, TP.HCM", isDefault: true },
  { id: "a2", name: "Trần Quân Trị", phone: "090 123 4567", address: "88 Láng Hạ, Đống Đa, Hà Nội", isDefault: false },
];

export const PREVIEW_AI_HISTORY: PreviewAiEntry[] = [
  { id: "ai1", date: "12/10/2026 21:04", results: 24, thumb: 0 },
  { id: "ai2", date: "09/10/2026 18:40", results: 18, thumb: 3 },
  { id: "ai3", date: "01/10/2026 09:12", results: 31, thumb: 6 },
];

export function orderStatusLabel(status: PreviewOrder["status"]): string {
  if (status === "processing") return "Đang xử lý";
  if (status === "shipping") return "Đang giao";
  if (status === "done") return "Hoàn thành";
  return "Đã hủy";
}

export const MERCHANT_STATS_NOTE =
  "Số liệu doanh thu/đơn hàng là minh họa cho bản xem trước; số lượng danh mục và sản phẩm lấy từ máy chủ.";
