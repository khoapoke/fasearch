"use client";

/**
 * Nhận biết asset logo có kênh alpha thật hay là ảnh nền đục.
 *
 * CSS mask mặc định dùng alpha: ảnh đục (PNG có nền trắng, JPEG) sẽ bị mask thành
 * MỘT KHỐI ĐẶC — đúng lỗi Control thấy với logo Degrey/SWE. Vì vậy phải kiểm tra
 * pixel thật (cùng origin, canvas readable) trước khi chọn cách render.
 */

export type LogoKind = "alpha" | "opaque" | "unknown";

const cache = new Map<string, LogoKind>();
const inflight = new Map<string, Promise<LogoKind>>();

async function probe(url: string): Promise<LogoKind> {
  try {
    const img = new Image();
    img.decoding = "async";
    const loaded = new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("load"));
    });
    img.src = url;
    await loaded;
    const size = 48;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return "unknown";
    ctx.clearRect(0, 0, size, size);
    ctx.drawImage(img, 0, 0, size, size);
    const data = ctx.getImageData(0, 0, size, size).data;
    let transparent = 0;
    for (let i = 3; i < data.length; i += 4) {
      if (data[i] < 250) transparent += 1;
    }
    // >2% pixel trong suốt ⇒ artwork dạng vector/alpha, mask một màu là an toàn.
    return transparent / (size * size) > 0.02 ? "alpha" : "opaque";
  } catch {
    return "unknown";
  }
}

export function logoKind(url: string): LogoKind {
  return cache.get(url) ?? "unknown";
}

export function probeLogoKind(url: string): Promise<LogoKind> {
  const hit = cache.get(url);
  if (hit) return Promise.resolve(hit);
  const running = inflight.get(url);
  if (running) return running;
  const p = probe(url).then((kind) => {
    cache.set(url, kind);
    inflight.delete(url);
    return kind;
  });
  inflight.set(url, p);
  return p;
}
