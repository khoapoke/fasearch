// Tên màu của biến thể (tiếng Việt/Anh) → màu chấm hiển thị trên thẻ sản phẩm.
// Trả null khi không nhận ra: thẻ bỏ chấm đó thay vì đoán màu.

const SWATCHES: Array<{ hex: string; keys: string[] }> = [
  { hex: "#1c1c1e", keys: ["đen", "den", "black"] },
  { hex: "#f5f5f4", keys: ["trắng", "trang", "white", "ivory"] },
  { hex: "#9ca3af", keys: ["xám", "xam", "ghi", "gray", "grey"] },
  { hex: "#22364f", keys: ["navy", "xanh đen", "xanh den", "xanh navy", "xanh than"] },
  { hex: "#3b6fb6", keys: ["xanh dương", "xanh duong", "xanh biển", "xanh bien", "blue", "jean", "denim"] },
  { hex: "#5b6b5c", keys: ["xanh rêu", "xanh reu", "rêu", "olive", "xanh lá", "xanh la", "green"] },
  { hex: "#c9bfae", keys: ["be", "beige", "kem", "nude", "khaki", "kaki", "cream"] },
  { hex: "#8a5a3c", keys: ["nâu", "nau", "brown", "camel"] },
  { hex: "#c0392b", keys: ["đỏ", "do", "red"] },
  { hex: "#e8a1b5", keys: ["hồng", "hong", "pink"] },
  { hex: "#e9b949", keys: ["vàng", "vang", "yellow", "mustard"] },
  { hex: "#e07b39", keys: ["cam", "orange"] },
  { hex: "#7d5aa6", keys: ["tím", "tim", "purple", "violet"] },
];

export function colorSwatch(name: string): string | null {
  const n = name.trim().toLowerCase();
  if (!n) return null;
  // Cụm dài trước ("xanh đen" trước "xanh") để không khớp nhầm.
  let best: { hex: string; len: number } | null = null;
  for (const entry of SWATCHES) {
    for (const key of entry.keys) {
      const hit = key.length <= 2 ? n === key || n.split(/[\s/,-]+/).includes(key) : n.includes(key);
      if (hit && (!best || key.length > best.len)) best = { hex: entry.hex, len: key.length };
    }
  }
  return best ? best.hex : null;
}
