"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { StorefrontShell } from "@/components/storefront/storefront-shell";
import { fetchCustomerOrder } from "@/lib/customer-commerce-client";
import { fetchPaymentAttempt } from "@/lib/customer-payments-client";
import {
  CommerceError, formatMoney, orderStatusText, paymentAttemptStatusText,
  type CustomerOrderDetail, type PaymentAttempt,
} from "@/lib/customer-commerce";
import "@/components/customer-commerce/commerce.css";

const POLL_MS = 2500;
const MAX_POLLS = 24;
const STORAGE_KEY = "fasearch:pay-attempt";

type Verdict = "loading" | "success" | "pending" | "unpaid" | "failed" | "expired" | "cancelled" | "review" | "missing" | "error";

// Same-tab return hint left by the checkout/order pages before redirecting to the
// provider. Query params and this hint never mark anything paid; only the
// authoritative attempt/order fetch below decides the verdict.
function initialRef(param: string, field: "attemptId" | "orderId"): string {
  if (/^\d+$/.test(param)) return param;
  if (typeof window === "undefined") return "";
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return "";
    const v = JSON.parse(raw) as { attemptId?: unknown; orderId?: unknown };
    const value = field === "attemptId" ? v.attemptId : v.orderId;
    return typeof value === "number" && Number.isSafeInteger(value) ? String(value) : "";
  } catch {
    return "";
  }
}

export default function PaymentResultPage() {
  return <Suspense fallback={<StorefrontShell active="/thanh-toan" themed palette="customer" header="customer" footer="none"><div className="commercePage"><p className="commerce-status" role="status">Đang tải kết quả thanh toán…</p></div></StorefrontShell>}><PaymentResultContent /></Suspense>;
}

function PaymentResultContent() {
  const router = useRouter();
  const params = useSearchParams();
  const paramOrder = params.get("orderId") ?? "";
  const paramAttempt = params.get("attemptId") ?? "";
  const cancelledHint = params.get("cancelled") === "1";

  const [orderId] = useState(() => initialRef(paramOrder, "orderId"));
  const [attemptId] = useState(() => initialRef(paramAttempt, "attemptId"));
  const [attempt, setAttempt] = useState<PaymentAttempt | null>(null);
  const [order, setOrder] = useState<CustomerOrderDetail | null>(null);
  const [verdict, setVerdict] = useState<Verdict>("loading");
  const [error, setError] = useState("");
  const [errorStatus, setErrorStatus] = useState(0);
  const [polls, setPolls] = useState(0);
  const pollsRef = useRef(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    if (!orderId && !attemptId) {
      setVerdict("missing");
      return "done" as const;
    }
    try {
      const [a, o] = await Promise.all([
        attemptId ? fetchPaymentAttempt(attemptId).catch(() => null) : Promise.resolve(null),
        orderId ? fetchCustomerOrder(orderId) : Promise.resolve(null),
      ]);
      setAttempt(a);
      setOrder(o);
      setError("");
      const orderStatus = o?.status ?? "";
      const attemptStatus = a?.status ?? "";
      // Success ONLY for a SETTLED payment attempt. Order status alone (confirmed by staff,
      // COD, unpaid online order) is not evidence of an online payment.
      if (attemptStatus === "SETTLED") return "success" as const;
      if (orderStatus === "CANCELLED" || attemptStatus === "CANCELLED") return "cancelled" as const;
      if (attemptStatus === "FAILED") return "failed" as const;
      if (attemptStatus === "EXPIRED") return "expired" as const;
      if (attemptStatus === "REVIEW_REQUIRED") return "review" as const;
      // Returned via cancel_url with nothing settled yet: show cancel + retry, keep polling off.
      if (cancelledHint) return "cancelled" as const;
      // No payment attempt to wait for (e.g. COD, or order handled without an online payment):
      // honest "no online payment recorded" instead of success or endless polling.
      if (!attemptId && o) return "unpaid" as const;
      return "pending" as const;
    } catch (failure) {
      if (failure instanceof CommerceError && failure.status === 401) {
        router.replace(`/dang-nhap?next=${encodeURIComponent(`/thanh-toan/ket-qua${window.location.search}`)}`);
        return "done" as const;
      }
      setErrorStatus(failure instanceof CommerceError ? failure.status : 0);
      setError(failure instanceof Error ? failure.message : "Không tải được kết quả thanh toán.");
      return "error" as const;
    }
  }, [attemptId, orderId, cancelledHint, router]);

  const refresh = useCallback(async () => {
    pollsRef.current = 0;
    setPolls(0);
    const outcome = await load();
    if (outcome === "done") return;
    setVerdict(outcome);
  }, [load]);

  useEffect(() => {
    let cancelled = false;
    pollsRef.current = 0;
    void Promise.resolve().then(async () => {
      const outcome = await load();
      if (cancelled || outcome === "done") return;
      if (outcome !== "pending") {
        setVerdict(outcome);
        return;
      }
      setVerdict("pending");
      timer.current = setInterval(() => {
        void (async () => {
          pollsRef.current += 1;
          setPolls(pollsRef.current);
          const next = await load();
          if (cancelled || next === "done") {
            if (timer.current) clearInterval(timer.current);
            return;
          }
          if (next !== "pending" || pollsRef.current >= MAX_POLLS) {
            if (timer.current) clearInterval(timer.current);
            setVerdict(next);
          }
        })();
      }, POLL_MS);
    });
    return () => {
      cancelled = true;
      if (timer.current) clearInterval(timer.current);
    };
  }, [load]);

  const headline: Record<Exclude<Verdict, "loading">, string> = {
    success: "Thanh toán thành công",
    pending: "Đang chờ đối soát thanh toán",
    unpaid: "Chưa ghi nhận thanh toán trực tuyến",
    failed: "Thanh toán thất bại",
    expired: "Phiên thanh toán đã hết hạn",
    cancelled: "Đã hủy thanh toán",
    review: "Thanh toán cần đối soát thủ công",
    missing: "Không tìm thấy phiên thanh toán",
    error: "Không tải được kết quả",
  };

  return (
    <StorefrontShell active="/thanh-toan" themed palette="customer" header="customer" footer="none">
      <div className="commercePage">
        <div className="commerce-content">
          <nav className="commerce-crumbs" aria-label="Đường dẫn"><Link href="/gio-hang">Giỏ hàng</Link><span aria-hidden="true">›</span><Link href="/thanh-toan">Thanh toán</Link><span aria-hidden="true">›</span><span aria-current="page">Kết quả</span></nav>
          <h1 className="commerce-title">Kết quả thanh toán</h1>
          <p className="commerce-sub">Hiển thị theo trạng thái đơn hàng và phiên thanh toán trên máy chủ — tham số trên đường dẫn không đánh dấu đã trả tiền.</p>

          {verdict === "loading" ? <p className="commerce-status" role="status">Đang đối soát với máy chủ…</p> : (
            <div className="commerce-empty" role={verdict === "success" || verdict === "unpaid" ? "status" : "alert"}>
              <h2>{headline[verdict]}</h2>
              {verdict === "success" ? <p>Đơn hàng của bạn đã được ghi nhận thanh toán qua kênh an toàn. Hóa đơn và điểm thưởng (nếu có) được chốt bởi máy chủ.</p> : null}
              {verdict === "pending" ? <p>Giao dịch đang chờ webhook/IPN đã ký từ cổng thanh toán. Trang tự kiểm tra lại trong khoảng 1 phút; làm mới không tạo đơn mới và không trừ tiền thêm.</p> : null}
              {verdict === "unpaid" ? <p>Đơn hàng đã được ghi nhận nhưng chưa có thanh toán trực tuyến nào được xác nhận. Nếu bạn chọn thanh toán khi nhận hàng (COD), bạn trả tiền khi nhận; nếu muốn trả online, hãy thanh toán từ trang đơn hàng.</p> : null}
              {verdict === "failed" ? <p>Giao dịch báo thất bại. Đơn hàng vẫn giữ nguyên, bạn có thể thử lại từ trang đơn hàng.</p> : null}
              {verdict === "expired" ? <p>Phiên thanh toán đã hết hạn. Đơn hàng vẫn giữ nguyên, bạn có thể tạo phiên mới từ trang đơn hàng.</p> : null}
              {verdict === "cancelled" ? <p>Bạn đã hủy thanh toán tại cổng. Đơn hàng vẫn giữ nguyên, bạn có thể thanh toán lại sau.</p> : null}
              {verdict === "review" ? <p>Giao dịch đến sau khi đơn đã khóa; máy chủ giữ lại để đối soát thủ công, không tự hoàn tất. Liên hệ hỗ trợ kèm mã đơn.</p> : null}
              {verdict === "missing" ? <p>Đường dẫn thiếu mã đơn/mã phiên (ví dụ mở trực tiếp). Mở đơn hàng của bạn để xem trạng thái mới nhất.</p> : null}
              {verdict === "error" ? <p>{errorStatus === 403 ? "Phiên này thuộc về tài khoản khác." : error}</p> : null}

              {(attempt || order) ? (
                <dl style={{ display: "grid", gap: 6, margin: "12px 0", fontSize: 14 }}>
                  {order ? <div style={{ display: "flex", gap: 8, justifyContent: "center" }}><dt>Mã đơn:</dt><dd style={{ margin: 0 }}><strong>{order.orderCode || `#${order.orderId}`}</strong> · {orderStatusText(order.status)} · {formatMoney(order.totalAmount)}</dd></div> : null}
                  {attempt ? <div style={{ display: "flex", gap: 8, justifyContent: "center" }}><dt>Kênh {attempt.provider}:</dt><dd style={{ margin: 0 }}>{paymentAttemptStatusText(attempt.status)} · {formatMoney(attempt.amount)} {attempt.currency}</dd></div> : null}
                </dl>
              ) : null}

              <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap", marginTop: 12 }}>
                {orderId ? <Link className="commerce-primary" href={`/don-hang/${orderId}`}>Về đơn hàng →</Link> : <Link className="commerce-primary" href="/don-hang">Về danh sách đơn hàng →</Link>}
                {verdict === "pending" || verdict === "error" ? <button className="commerce-ghost" type="button" onClick={() => void refresh()}>Kiểm tra lại{polls > 0 ? ` (${polls})` : ""}</button> : null}
                {verdict === "failed" || verdict === "expired" || verdict === "cancelled" || verdict === "unpaid" ? (orderId ? <Link className="commerce-ghost" href={`/don-hang/${orderId}`}>Thanh toán lại từ đơn hàng</Link> : null) : null}
              </div>
            </div>
          )}
        </div>
      </div>
    </StorefrontShell>
  );
}
