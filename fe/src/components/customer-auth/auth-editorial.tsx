"use client";

import { useState } from "react";

const LOGIN_PHOTO = {
  src: "https://images.unsplash.com/photo-1776273920142-f30bceff0cf3?auto=format&fit=max&w=1100&q=85",
  page: "https://unsplash.com/photos/woman-in-white-coat-and-pants-stands-against-gray-background-HFdLDbRvI4g",
  author: "Shane Ryan Herilalaina",
  alt: "Người mẫu mặc áo khoác sáng màu và quần âu trong studio xám",
};

export function AuthEditorial() {
  const [failed, setFailed] = useState(false);
  return (
    <figure className="auth-editorial" aria-label="Ảnh thời trang minh họa">
      <div className="auth-top">
        <p className="auth-eyebrow">FaSearch</p>
        <p className="auth-statement">Gu riêng.<br />Cách tìm riêng.</p>
      </div>
      <div className="auth-photo">
        {failed ? (
          <span className="auth-photo-fail" role="img" aria-label={`Không tải được ảnh: ${LOGIN_PHOTO.alt}`}>
            Không tải được ảnh minh họa
          </span>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element -- ảnh Unsplash minh họa, không qua Image optimizer
          <img src={LOGIN_PHOTO.src} alt={LOGIN_PHOTO.alt} loading="eager" decoding="async" referrerPolicy="no-referrer" onError={() => setFailed(true)} />
        )}
      </div>
      <figcaption>
        <a className="auth-credit" href={LOGIN_PHOTO.page} target="_blank" rel="noopener noreferrer">
          Ảnh Unsplash · {LOGIN_PHOTO.author}
        </a>
      </figcaption>
    </figure>
  );
}
