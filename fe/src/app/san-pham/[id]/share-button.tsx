"use client";

import { useEffect, useRef, useState } from "react";

function ShareIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d="M12 15V3.5M7.5 8 12 3.5 16.5 8" />
      <path d="M5 12.5V19a1.5 1.5 0 0 0 1.5 1.5h11A1.5 1.5 0 0 0 19 19v-6.5" />
    </svg>
  );
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const area = document.createElement("textarea");
      area.value = text;
      area.setAttribute("readonly", "");
      area.style.position = "fixed";
      area.style.opacity = "0";
      document.body.appendChild(area);
      area.select();
      const ok = document.execCommand("copy");
      area.remove();
      return ok;
    } catch {
      return false;
    }
  }
}

/** Chia sẻ: Web Share API (điện thoại) → sao chép liên kết (máy tính) + toast. */
export function ShareButton({ title, price }: { title: string; price?: string }) {
  const [toast, setToast] = useState<{ text: string; tone: "ok" | "err" } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  function show(text: string, tone: "ok" | "err" = "ok") {
    setToast({ text, tone });
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast(null), 2800);
  }

  async function share() {
    const url = window.location.origin + window.location.pathname;
    const text = price ? `${title} — ${price}` : title;
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title, text, url });
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return; // khách tự đóng bảng chia sẻ
        // lỗi khác: rơi xuống sao chép liên kết
      }
    }
    const ok = await copyText(url);
    show(ok ? "Đã sao chép liên kết sản phẩm" : "Không sao chép được. Hãy sao chép địa chỉ trên thanh trình duyệt.", ok ? "ok" : "err");
  }

  return (
    <>
      <button className="pdShare" type="button" onClick={share}>
        <ShareIcon /> <span>Chia sẻ</span>
      </button>
      <span className={"pdToast" + (toast ? " is-on" : "") + (toast?.tone === "err" ? " is-err" : "")} role="status" aria-live="polite">
        {toast?.text ?? ""}
      </span>
    </>
  );
}
