"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  getAiSync,
  listDrafts,
  publishDraft,
  retryAiSync,
  unpublishProduct,
  CatalogAdminError,
  type AdminDraft,
  type AiSyncState,
  type Product,
} from "@/lib/admin-catalog-client";

/**
 * Publication lifecycle + AI sync state for one product — real contract flow.
 *
 * - Bản nháp: tìm trong danh sách nháp đang mở theo productId; chưa có thì tạo
 *   từ dữ liệu hiện tại (BE liên kết qua published_ref_id / đặt hàng DRAFT mới).
 * - Xuất bản: POST publish với expectedVersion; 409 DATA_CONFLICT tải lại bản
 *   nháp hiện tại và báo phiên mới — không bao giờ ghi đè im lặng.
 * - Gỡ xuất bản: POST unpublish; ẩn khỏi catalog công khai + tombstone AI.
 * - AI sync: GET trạng thái thật; retry POST chỉ xếp lại FAILED→PENDING.
 *   Trước khi hợp đồng BE tồn tại, panel báo `unavailable` trung thực.
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
  | { kind: "ready"; state: AiSyncState }
  | { kind: "error"; message: string };

async function call<T>(run: () => Promise<T>, signal?: AbortSignal): Promise<T> {
  void signal;
  return run();
}

export function ProductPublication({ product, onChanged }: { product: Product; onChanged: (next: Product) => void }) {
  const [busy, setBusy] = useState(false);
  const [issue, setIssue] = useState("");
  const [notice, setNotice] = useState("");
  const [draft, setDraft] = useState<AdminDraft | null>(null);
  const [draftLoading, setDraftLoading] = useState(true);
  const [ai, setAi] = useState<AiSync>({ kind: "checking" });

  const loadDraft = useCallback(
    async (signal?: AbortSignal) => {
      setDraftLoading(true);
      try {
        const drafts = await call(() => listDrafts("page=0&size=50", signal), signal);
        const mine = drafts.find((d) => d.productId === product.id) ?? null;
        setDraft(mine);
      } catch {
        setDraft(null);
      } finally {
        setDraftLoading(false);
      }
    },
    [product.id],
  );

  const probeAi = useCallback(
    async (signal?: AbortSignal) => {
      setAi({ kind: "checking" });
      try {
        const state = await call(() => getAiSync(product.id, signal), signal);
        setAi({ kind: "ready", state });
      } catch (failure) {
        if (signal?.aborted) return;
        if (failure instanceof CatalogAdminError && failure.status === 404) {
          setAi({ kind: "unavailable", message: "Trạng thái đồng bộ AI chưa có — chờ hợp đồng BE (API-CONTRACT)." });
          return;
        }
        setAi({ kind: "error", message: failure instanceof Error ? failure.message : "Không đọc được trạng thái AI." });
      }
    },
    [product.id],
  );

  useEffect(() => {
    const controller = new AbortController();
    void loadDraft(controller.signal);
    void probeAi(controller.signal);
    return () => controller.abort();
  }, [loadDraft, probeAi]);

  async function publish() {
    if (busy || !draft) return;
    setBusy(true);
    setIssue("");
    setNotice("");
    try {
      const result = await publishDraft(draft.draftId, draft.version);
      setNotice(`Đã xuất bản phiên bản ${result.version}. AI: ${typeof result === "object" && result !== null && "aiSync" in result ? String((result as { aiSync: unknown }).aiSync) : "PENDING"}.`);
      onChanged({ ...product, status: "ACTIVE" });
      await loadDraft();
      await probeAi();
    } catch (failure) {
      if (failure instanceof CatalogAdminError && failure.status === 409) {
        setIssue("Bản nháp đã có phiên bản mới hơn (409). Đã tải lại — kiểm tra rồi xuất bản lại, không ghi đè.");
        await loadDraft();
        return;
      }
      setIssue(failure instanceof Error ? failure.message : "Không xuất bản được.");
    } finally {
      setBusy(false);
    }
  }

  async function unpublish() {
    if (busy) return;
    if (!window.confirm("Gỡ sản phẩm khỏi catalog công khai? Điểm AI sẽ bị đánh dấu xóa.")) return;
    setBusy(true);
    setIssue("");
    setNotice("");
    try {
      await unpublishProduct(product.id);
      setNotice("Đã gỡ xuất bản. Nội dung công khai và điểm AI sẽ biến mất sau khi BE xử lý.");
      onChanged({ ...product, status: "DRAFT" });
      await probeAi();
    } catch (failure) {
      setIssue(failure instanceof Error ? failure.message : "Không gỡ xuất bản được.");
    } finally {
      setBusy(false);
    }
  }

  async function retry() {
    setAi((current) => (current.kind === "ready" ? { kind: "ready", state: current.state } : current));
    try {
      await retryAiSync(product.id);
      setNotice("Đã gửi yêu cầu thử lại đồng bộ AI.");
      await probeAi();
    } catch (failure) {
      setAi({ kind: "error", message: failure instanceof Error ? failure.message : "Không gửi được yêu cầu thử lại." });
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
            {draftLoading ? " · đang tìm bản nháp…" : draft ? ` · bản nháp v${draft.version}` : " · chưa có bản nháp"}
          </p>
        </div>
        <div className="catalog-inline">
          <Link className="text-link" href={`/san-pham/${product.id}`} aria-label={`Xem trước ${product.productName} với giao diện khách hàng`}>
            Xem trước (giao diện khách)
          </Link>
          {published ? (
            <button className="text-link" type="button" disabled={busy} aria-disabled={busy} onClick={() => void unpublish()}>
              {busy ? "Đang gỡ…" : "Gỡ xuất bản"}
            </button>
          ) : draft ? (
            <button className="primary" type="button" disabled={busy} aria-disabled={busy} onClick={() => void publish()}>
              {busy ? "Đang xuất bản…" : `Xuất bản bản nháp v${draft.version}`}
            </button>
          ) : (
            <span className="meta">Chưa có bản nháp — tạo ở trang sửa metadata</span>
          )}
        </div>
      </div>
      {issue ? (
        <p className="catalog-error" role="alert">
          {issue}
        </p>
      ) : null}
      {notice ? (
        <p className="meta" role="status">
          {notice}
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
            Trạng thái: <strong>{ai.state.status}</strong> · phiên bản {ai.state.version} · lần thử {ai.state.attempts}
            {ai.state.updatedAt ? ` · cập nhật ${ai.state.updatedAt}` : ""}
            {ai.state.lastError ? ` · lỗi: ${ai.state.lastError}` : ""}
            {ai.state.status === "FAILED" ? (
              <button className="text-link" type="button" onClick={() => void retry()} style={{ marginLeft: 8 }}>
                Thử lại đồng bộ
              </button>
            ) : (
              <button className="text-link" type="button" onClick={() => void probeAi()} style={{ marginLeft: 8 }}>
                Tải lại
              </button>
            )}
          </p>
        ) : null}
      </div>
    </section>
  );
}
