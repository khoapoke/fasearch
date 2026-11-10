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
import { ConfirmDialog } from "@/components/admin-b/confirm-dialog";
import { InfoHint } from "@/components/admin-b/info-hint";
import { Icon } from "@/components/admin-b/icons";
import { formatDateTime } from "@/lib/admin-format";
import "@/components/admin-b/h2.css";

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

const AI_STATUS_LABEL: Record<string, string> = {
  NEVER_QUEUED: "Chưa đưa vào hàng đợi",
  PENDING: "Đang chờ đồng bộ",
  RUNNING: "Đang đồng bộ",
  READY: "Sẵn sàng",
  FAILED: "Đồng bộ thất bại",
};
function aiStatusLabel(v: string): string {
  return AI_STATUS_LABEL[v] ?? "Chưa rõ trạng thái";
}
// Healthy for a published product: READY, or NEVER_QUEUED (seed products were bulk-indexed without a sync row).
function aiHealthy(v: string): boolean {
  return v === "READY" || v === "NEVER_QUEUED";
}

type AiSync =
  | { kind: "checking" }
  | { kind: "unavailable"; message: string }
  | { kind: "ready"; state: AiSyncState }
  | { kind: "error"; message: string };

async function call<T>(run: () => Promise<T>, signal?: AbortSignal): Promise<T> {
  void signal;
  return run();
}

export function ProductPublication(props: { product: Product; onChanged: (next: Product) => void }) {
  // Keyed by product: another product starts from the loading state instead of an effect-driven reset.
  return <ProductPublicationBody key={props.product.id} {...props} />;
}

function ProductPublicationBody({ product, onChanged }: { product: Product; onChanged: (next: Product) => void }) {
  const [busy, setBusy] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [issue, setIssue] = useState("");
  const [notice, setNotice] = useState("");
  const [draft, setDraft] = useState<AdminDraft | null>(null);
  const [draftLoading, setDraftLoading] = useState(true);
  const [ai, setAi] = useState<AiSync>({ kind: "checking" });

  // Pure fetchers: they return the next state and never set it, so an effect can use them directly.
  const fetchMine = useCallback(async (signal?: AbortSignal): Promise<AdminDraft | null> => {
    try {
      const drafts = await call(() => listDrafts("page=0&size=50", signal), signal);
      return drafts.find((d) => d.productId === product.id) ?? null;
    } catch {
      return null;
    }
  }, [product.id]);

  const fetchAi = useCallback(async (signal?: AbortSignal): Promise<AiSync> => {
    try {
      return { kind: "ready", state: await call(() => getAiSync(product.id, signal), signal) };
    } catch (failure) {
      if (failure instanceof CatalogAdminError && failure.status === 404) {
        return { kind: "unavailable", message: "Chưa có trạng thái đồng bộ AI." };
      }
      return { kind: "error", message: failure instanceof Error ? failure.message : "Không đọc được trạng thái AI." };
    }
  }, [product.id]);

  // Used by handlers: show the loading state, refetch, then apply.
  const loadDraft = useCallback(async () => {
    setDraftLoading(true);
    setDraft(await fetchMine());
    setDraftLoading(false);
  }, [fetchMine]);
  const probeAi = useCallback(async () => {
    setAi({ kind: "checking" });
    setAi(await fetchAi());
  }, [fetchAi]);

  useEffect(() => {
    const controller = new AbortController();
    void fetchMine(controller.signal).then((mine) => {
      if (controller.signal.aborted) return;
      setDraft(mine);
      setDraftLoading(false);
    });
    void fetchAi(controller.signal).then((next) => {
      if (!controller.signal.aborted) setAi(next);
    });
    return () => controller.abort();
  }, [fetchMine, fetchAi]);

  async function publish() {
    if (busy || !draft) return;
    setBusy(true);
    setIssue("");
    setNotice("");
    try {
      const result = await publishDraft(draft.draftId, draft.version);
      setNotice(`Đã Publish phiên bản ${result.version}. AI: ${aiStatusLabel(typeof result === "object" && result !== null && "aiSync" in result ? String((result as { aiSync: unknown }).aiSync) : "PENDING")}.`);
      onChanged({ ...product, status: "ACTIVE", publicationStatus: "PUBLISHED" });
      await loadDraft();
      await probeAi();
    } catch (failure) {
      if (failure instanceof CatalogAdminError && failure.status === 409) {
        setIssue("Draft đã có phiên bản mới hơn. Đã tải lại; kiểm tra rồi Publish lại.");
        await loadDraft();
        return;
      }
      setIssue(failure instanceof Error ? failure.message : "Không Publish được.");
    } finally {
      setBusy(false);
    }
  }

  async function unpublish() {
    if (busy) return;
    setBusy(true);
    setIssue("");
    setNotice("");
    try {
      await unpublishProduct(product.id);
      setNotice("Đã Unpublish. Nội dung công khai sẽ ẩn sau khi xử lý.");
      onChanged({ ...product, status: "DRAFT", publicationStatus: "UNPUBLISHED" });
      await probeAi();
    } catch (failure) {
      setIssue(failure instanceof Error ? failure.message : "Không Unpublish được.");
    } finally {
      setBusy(false);
      setConfirmOpen(false);
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

  const pubState = product.publicationStatus ?? null;
  const published = pubState === "PUBLISHED";
  const pubLabel = published ? "Đã Publish" : pubState === "UNPUBLISHED" ? "Đã Unpublish" : "Chưa Publish";
  const pubTone = published ? "green" : pubState === "UNPUBLISHED" ? "orange" : "gray";
  return (
    <section className="pp-card" aria-label="Publish và đồng bộ AI">
      <div className="pp-head">
        <h2>Publish</h2>
        <span className={`badge t-${pubTone}`}>{pubLabel}</span>
        <InfoHint align="end">
          Nội dung sửa được lưu vào Draft và chỉ hiển thị với khách hàng sau khi Publish. Chưa có Draft thì tạo ở trang sửa sản phẩm. Unpublish sẽ ẩn sản phẩm khỏi cửa hàng.
        </InfoHint>
      </div>
      <p className="pp-line">
        {draftLoading ? "Đang tìm Draft…" : draft ? <>Draft <strong>v{draft.version}</strong> đang chờ</> : "Chưa có Draft"}
      </p>
      <div className="pp-actions">
        {draft ? (
          <button className="primary btn-sm" type="button" disabled={busy} aria-disabled={busy} onClick={() => void publish()}>
            {busy ? "Đang Publish…" : `Publish v${draft.version}`}
          </button>
        ) : null}
        {draft ? (
          <Link className="secondary btn-sm" href={`/quan-tri/san-pham/${product.id}/xem-truoc`}>
            Xem trước Draft
          </Link>
        ) : null}
        {published ? (
          <Link className="secondary btn-sm" href={`/san-pham/${product.id}`}>
            Xem trên cửa hàng
          </Link>
        ) : null}
        {published ? (
          <button className="danger btn-sm" type="button" disabled={busy} aria-disabled={busy} onClick={() => setConfirmOpen(true)}>
            {busy ? "Đang gỡ…" : "Unpublish"}
          </button>
        ) : null}
      </div>
      {issue ? <p className="catalog-error" role="alert">{issue}</p> : null}
      {notice ? <p className="meta" role="status">{notice}</p> : null}
      {published ? (
        <div className="pp-ai" aria-label="Trạng thái đồng bộ AI">
          {ai.kind === "checking" ? <span className="meta" role="status">Đang kiểm tra…</span> : null}
          {ai.kind === "unavailable" ? <span className="meta">{ai.message}</span> : null}
          {ai.kind === "error" ? (
            <span role="alert" className="pp-ai-row">
              <span className="catalog-error">{ai.message}</span>
              <button className="secondary btn-sm" type="button" onClick={() => void probeAi()}>Thử lại</button>
            </span>
          ) : null}
          {ai.kind === "ready" && aiHealthy(ai.state.status) ? (
            <span className="pp-ai-ok" role="status">
              <Icon name="check" size={14} />
              Đã có trong AI search
            </span>
          ) : null}
          {ai.kind === "ready" && ai.state.status === "FAILED" ? (
            <span className="pp-ai-row" role="status">
              <span className="badge t-red pp-ai-warn">
                <Icon name="circle-alert" size={13} />
                Lỗi đồng bộ AI search
              </span>
              {ai.state.updatedAt ? <span className="meta">{formatDateTime(ai.state.updatedAt)}</span> : null}
              {ai.state.lastError ? <InfoHint align="end" label="Chi tiết lỗi đồng bộ">{ai.state.lastError}</InfoHint> : null}
              <button className="secondary btn-sm" type="button" onClick={() => void retry()}>Thử lại đồng bộ</button>
            </span>
          ) : null}
          {ai.kind === "ready" && !aiHealthy(ai.state.status) && ai.state.status !== "FAILED" ? (
            <span className="pp-ai-row" role="status">
              <span className="meta">Đang đồng bộ AI search…</span>
              <button className="secondary btn-sm" type="button" onClick={() => void probeAi()}>Tải lại</button>
            </span>
          ) : null}
        </div>
      ) : null}
      <ConfirmDialog
        open={confirmOpen}
        title="Unpublish sản phẩm?"
        message="Gỡ sản phẩm khỏi cửa hàng? Điểm AI sẽ bị đánh dấu xóa."
        confirmLabel="Unpublish"
        tone="danger"
        busy={busy}
        onConfirm={() => void unpublish()}
        onClose={() => setConfirmOpen(false)}
      />
    </section>
  );
}
