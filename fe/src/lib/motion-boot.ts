// Không "use client": layout (server component) gọi hàm này.
export const MOTION_STORAGE_KEY = "fa-motion";

/** Script chạy trước lần vẽ đầu: đặt html[data-motion="off"] để CSS tắt chuyển động ngay. */
export function motionBootScript(): string {
  return `(function(){try{if(localStorage.getItem(${JSON.stringify(MOTION_STORAGE_KEY)})==="off")`
    + `document.documentElement.setAttribute("data-motion","off");}catch(e){}})();`;
}
