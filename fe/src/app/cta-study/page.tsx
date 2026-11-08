"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { StorefrontShell } from "@/components/storefront/storefront-shell";
import "./cta-study.css";

type StateKey = "rest" | "hover" | "press" | "focus" | "disabled" | "loading";

const STATES: Array<{ key: StateKey; label: string }> = [
  { key: "rest", label: "Nghỉ" },
  { key: "hover", label: "Hover" },
  { key: "press", label: "Nhấn" },
  { key: "focus", label: "Bàn phím" },
  { key: "disabled", label: "Tạm khóa" },
  { key: "loading", label: "Đang xử lý" },
];

const CONTEXTS = [
  { label: "Sản phẩm", hint: "Thêm vào giỏ" },
  { label: "Tìm bằng AI", hint: "Bắt đầu tìm" },
  { label: "Đơn hàng", hint: "Theo dõi đơn" },
];

function Spinner() {
  return <span className="ctaSpin" aria-hidden="true" />;
}

/**
 * So sánh CTA trong ngữ cảnh FaSearch thật.
 * Chỉ mô phỏng trạng thái — không đặt hàng, không điều hướng thật.
 */
export default function CtaStudyPage() {
  const [state, setState] = useState<StateKey>("rest");
  const [motionOff, setMotionOff] = useState(false);

  useEffect(() => {
    document.title = "Nghiên cứu CTA | FaSearch";
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional: state sync/reset or one-shot mount read inside an effect; refactor would change behaviour
    try { setMotionOff(localStorage.getItem("fa-motion") === "off"); } catch { /* ignore */ }
  }, []);

  return (
    <StorefrontShell active="/cta-study" themed palette="customer" header="customer" footer="none">
      <div className="ctaPage" data-motion={motionOff ? "off" : "auto"}>
        <div className="ctaNote" role="note">
          <span className="ctaTag">Nghiên cứu thiết kế</span>
          <span>Ba biến thể CTA trong ngữ cảnh thật. Chưa áp dụng vào Home, giỏ hàng hay quản trị.</span>
        </div>

        <header className="ctaHead">
          <h1>Kiểu nút hành động chính</h1>
          <p>So sánh nút hiện tại với hai hướng tham khảo: khung ngắm Tactical và điểm nhấn Pixel tiết chế.</p>
        </header>

        <div className="ctaControls" role="group" aria-label="Chọn trạng thái để xem">
          {STATES.map((s) => (
            <button
              key={s.key}
              type="button"
              className="ctaStateBtn"
              aria-pressed={state === s.key}
              onClick={() => setState(s.key)}
            >
              {s.label}
            </button>
          ))}
        </div>

        <div className="ctaGrid">
          <section className="ctaCol" aria-labelledby="cta-baseline">
            <h2 id="cta-baseline">Hiện tại</h2>
            <p className="ctaHint">Nút chính đang dùng trong mua hàng.</p>
            {CONTEXTS.map((c) => (
              <div className="ctaRow" key={c.label}>
                <span className="ctaCtx">{c.label}</span>
                <button
                  type="button"
                  className="ctaBase"
                  data-state={state}
                  disabled={state === "disabled"}
                  aria-busy={state === "loading" || undefined}
                >
                  {state === "loading" ? <><Spinner /> Đang xử lý…</> : c.hint}
                </button>
              </div>
            ))}
          </section>

          <section className="ctaCol" aria-labelledby="cta-tactical">
            <h2 id="cta-tactical">Tactical — khung ngắm</h2>
            <p className="ctaHint">Bốn góc lấy từ ngôn ngữ khung ngắm FaSearch, nhích nhẹ khi trỏ.</p>
            {CONTEXTS.map((c) => (
              <div className="ctaRow" key={c.label}>
                <span className="ctaCtx">{c.label}</span>
                <button
                  type="button"
                  className="ctaTactical"
                  data-state={state}
                  disabled={state === "disabled"}
                  aria-busy={state === "loading" || undefined}
                >
                  <span className="ctaCorner" aria-hidden="true" />
                  {state === "loading" ? <><Spinner /> Đang xử lý…</> : c.hint}
                </button>
              </div>
            ))}
          </section>

          <section className="ctaCol" aria-labelledby="cta-pixel">
            <h2 id="cta-pixel">Pixel — điểm nhấn</h2>
            <p className="ctaHint">Chỉ một vệt sáng theo con trỏ, không hạt, không nền chuyển động.</p>
            {CONTEXTS.map((c) => (
              <div className="ctaRow" key={c.label}>
                <span className="ctaCtx">{c.label}</span>
                <button
                  type="button"
                  className="ctaPixel"
                  data-state={state}
                  disabled={state === "disabled"}
                  aria-busy={state === "loading" || undefined}
                >
                  <span className="ctaSheen" aria-hidden="true" />
                  {state === "loading" ? <><Spinner /> Đang xử lý…</> : c.hint}
                </button>
              </div>
            ))}
          </section>
        </div>

        <p className="ctaFoot">
          Hiệu ứng chỉ chạy khi trỏ chuột hoặc nhấn; bàn phím phản hồi tức thì.{" "}
          {motionOff
            ? "Bạn đang tắt chuyển động nên các hiệu ứng này không chạy."
            : "Tắt chuyển động trong ứng dụng hoặc giảm chuyển động của hệ điều hành sẽ dừng các hiệu ứng này."}{" "}
          <Link href="/tai-khoan">Về tài khoản</Link>
        </p>
      </div>
    </StorefrontShell>
  );
}
