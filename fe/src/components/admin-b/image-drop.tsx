"use client";

import { useState, type RefObject } from "react";
import { resolveDraftImageUrl, toCatalogImageUrl } from "@/lib/admin-catalog-client";
import { Icon } from "./icons";

export const IMAGE_MAX_BYTES = 5 * 1024 * 1024;

/** Returns a Vietnamese message when the file is not an allowed image, otherwise "". */
export function checkImageFile(file: File, accept: string[], maxBytes = IMAGE_MAX_BYTES): string {
  if (!accept.includes(file.type)) {
    const names = accept.map((t) => t.replace("image/", "").toUpperCase().replace("JPEG", "JPG"));
    return `Chỉ nhận ảnh ${names.join(", ")}.`;
  }
  if (file.size > maxBytes) return `Ảnh lớn quá ${Math.round(maxBytes / 1048576)}MB. Chọn ảnh nhỏ hơn.`;
  return "";
}

/** Maps stored image paths (catalog or draft) to a URL the browser can load. */
export function imageSrc(raw: string | null | undefined): string | null {
  if (!raw) return null;
  return resolveDraftImageUrl(toCatalogImageUrl(raw));
}

/** Square image with a quiet fallback when the picture is missing or fails to load. */
export function ImagePreview({ src, alt }: { src: string | null; alt: string }) {
  const [failed, setFailed] = useState<string | null>(null);
  if (!src || failed === src) {
    return <span className="img-fallback" role="img" aria-label={`Chưa có ảnh: ${alt}`}><Icon name="package" size={36} /></span>;
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element -- BE/BFF image or local blob preview
    <img className="img-preview" src={src} alt={alt} referrerPolicy="no-referrer" onError={() => setFailed(src)} />
  );
}

/**
 * Drop zone: dashed while empty, 1:1 preview once there is a picture. Drag and drop or click.
 * The parent owns the hidden input through `inputRef`, so its buttons (Đổi ảnh) can open the picker.
 */
export function ImageDrop({
  preview,
  alt,
  accept,
  disabled = false,
  inputRef,
  onFile,
  onReject,
  hint,
}: {
  preview: string | null;
  alt: string;
  accept: string[];
  disabled?: boolean;
  inputRef: RefObject<HTMLInputElement | null>;
  onFile: (file: File) => void;
  onReject?: (message: string) => void;
  hint?: string;
}) {
  const [over, setOver] = useState(false);
  function take(file: File | undefined) {
    if (!file || disabled) return;
    const problem = checkImageFile(file, accept);
    if (problem) { onReject?.(problem); return; }
    onFile(file);
  }
  return (
    <div
      className={`img-drop${preview ? " has-image" : ""}${over ? " is-over" : ""}${disabled ? " is-disabled" : ""}`}
      onDragOver={(e) => { if (disabled) return; e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => { e.preventDefault(); setOver(false); take(e.dataTransfer.files?.[0]); }}
    >
      <input
        ref={inputRef}
        className="img-drop-input"
        type="file"
        accept={accept.join(",")}
        tabIndex={-1}
        aria-hidden="true"
        disabled={disabled}
        onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; take(f); }}
      />
      {preview ? (
        <ImagePreview src={preview} alt={alt} />
      ) : (
        <button type="button" className="img-drop-empty" disabled={disabled} onClick={() => inputRef.current?.click()}>
          <Icon name="image-plus" size={28} />
          <strong>Kéo ảnh vào đây</strong>
          <span>hoặc bấm để chọn ảnh</span>
          {hint ? <small>{hint}</small> : null}
        </button>
      )}
    </div>
  );
}
