"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { updateProduct, type Product } from "@/lib/admin-catalog-client";

/**
 * Publication lifecycle + AI sync state for one product.
 *
 * - Lifecycle is derived from the real `status` field; publish/unpublish use the
 *   existing PATCH status endpoint (no new behaviour, no invented workflow).
 * - Preview renders the already-fetched draft data with the Customer layout;
 *   unpublished items are never fetched through the public path here.
 * - AI sync states come only from the real BE contract endpoint
 *   (`/api/admin/catalog/products/[id]/ai-sync`, published with API-CONTRACT).
 *   Until the contract exists the panel honestly reports `unavailable` and the
 *   retry button only re-probes — it never fabricates a READY state.
 */

const STATUS_LABEL: Record<string, string> = {
  DRAFT: "Nháp",
  ACTIVE: "Đang bán",
  OUT_OF_STOCK: "Tạm hết hàng",
  DISCONTINUED: "Ngừng kinh doanh",
};

type AiSync =
  | { kind: "checking" }
  | { kind: "unavailable"; message: string }
  | { kind: "ready"; state: string; version: number | null; updatedAt: string | null }
  | { kind: "error"; message: string };

export function ProductPublication({ product, onChanged }: { product: Product; onChanged: (next: Product) => void }) {
  const [busy, setBusy] = useState(false);
  const [issue, setIssue] = useState("");
  const [ai, setAi] = useState<AiSync>({ kind: "checking" });

  const probeAi = useCallback(
    async (signal?: AbortSignal) => {
      setAi({ kind: "checking" });
      try {
        const response = await fetch(`/api/admin/catalog/products/${product.id}/ai-sync`, {
          cache: "no-store",
          signal,
        });
        if (response.status === 404) {
          setAi({ kind: "unavailable", message: "Trạng thái đồng bộ AI chưa có — chờ hợp đồng BE (API-CONTRACT)." });
          return;
        }
        const payload = (await response.json().catch(() => null)) as {
          success?: boolean;
          message?: string;
          result?: { state?: unknown; version?: unknown; updatedAt?: unknown } | null;
        } | null;
        if (!response.ok || payload?.success !== true || !payload.result) {
          setAi({ kind: "error", message: payload?.message || `Không đọc được trạng thái AI (HTTP ${response.status}).` });
          return;
        }
        setAi({
          kind: "ready",
          state: typeof payload.result.state === "string" ? payload.result.state : "UNKNOWN",
          version: typeof payload.result.version === "number" ? payload.result.version : null,
          updatedAt: typeof payload.result.updatedAt === "string" ? payload.result.updatedAt : null,
        });
      } catch (failure) {
        if (signal?.aborted) return;
        setAi({ kind: "error", message: failure instanceof Error ? failure.message : "Không kết nối được máy chủ." });
      }
    },
    [product.id],
  );

  useEffect(() => {
    const controller = new AbortController();
    void probeAi(controller.signal);
    return () => controller.abort();
  }, [probeAi]);

  async function setStatus(next: "DRAFT" | "ACTIVE") {
    if (busy) return;
    setBusy(true);
    setIssue("");
    try {
      onChanged(await updateProduct(String(product.id), { status: next }));
    } catch (failure) {
      setIssue(failure instanceof Error ? failure.message : "Không đổi được trạng thái xuất bản.");
    } finally {
      setBusy(false);
    }
  }

  const published = product.status === "ACTIVE";
  return (
    <section className="workbench" aria-label="Xuất bản và đồng bộ AI" style={{ marginBottom: 18 }}>
      <div className="section-head">
        <div>
          <h2>Xuất bản</h2>
          <p className="meta">
            Trạng thái hiện tại: <strong>{STATUS_LABEL[product.status] ?? product.status}</strong>
            {published ? " · đang hiển thị công khai" : " · chưa hiển thị công khai"}
          </p>
        </div>
        <div className="catalog-inline">
          <Link className="text-link" href={`/san-pham/${product.id}`} aria-label={`Xem trước ${product.productName} với giao diện khách hàng`}>
            Xem trước (giao diện khách)
          </Link>
          {published ? (
            <button className="text-link" type="button" disabled={busy} aria-disabled={busy} onClick={() => void setStatus("DRAFT")}>
              {busy ? "Đang gỡ…" : "Gỡ xuất bản"}
            </button>
          ) : (
            <button className="primary" type="button" disabled={busy} aria-disabled={busy} onClick={() => void setStatus("ACTIVE")}>
              {busy ? "Đang xuất bản…" : "Xuất bản"}
            </button>
          )}
        </div>
      </div>
      {issue ? (
        <p className="catalog-error" role="alert">
          {issue}
        </p>
      ) : null}
      <div aria-label="Trạng thái đồng bộ AI" style={{ marginTop: 12 }}>
        <p className="meta" style={{ marginBottom: 6 }}>
          <strong>Đồng bộ AI</strong>
        </p>
        {ai.kind === "checking" ? (
          <p className="meta" role="status">
            Đang kiểm tra trạng thái đồng bộ AI…
          </p>
        ) : null}
        {ai.kind === "unavailable" ? <p className="meta">{ai.message}</p> : null}
        {ai.kind === "error" ? (
          <div role="alert">
            <p className="catalog-error">{ai.message}</p>
            <button className="text-link" type="button" onClick={() => void probeAi()}>
              Thử lại
            </button>
          </div>
        ) : null}
        {ai.kind === "ready" ? (
          <p className="meta" role="status">
            Trạng thái: <strong>{ai.state}</strong>
            {ai.version !== null ? ` · phiên bản ${ai.version}` : ""}
            {ai.updatedAt ? ` · cập nhật ${ai.updatedAt}` : ""}
            <button className="text-link" type="button" onClick={() => void probeAi()} style={{ marginLeft: 8 }}>
              Tải lại
            </button>
          </p>
        ) : null}
      </div>
    </section>
  );
}
