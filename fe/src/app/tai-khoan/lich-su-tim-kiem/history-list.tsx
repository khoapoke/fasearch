"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { fetchCsrf, readOwnProfile } from "@/components/account/account-session";
import {
  groupHistoryByDay,
  modeLabel,
  parseLibraryMode,
  textResearchHref,
  type HistoryListItem,
  type LibraryMode,
} from "@/lib/library-contract";
import accountStyles from "@/components/account/account.module.css";
import styles from "./history-list.module.css";

type PageState =
  | { status: "loading" }
  | { status: "denied" }
  | { status: "error"; message: string }
  | {
      status: "ready";
      items: HistoryListItem[];
      total: number;
      recording: boolean;
    };

const MODE_FILTERS: Array<{ value: LibraryMode | null; label: string }> = [
  { value: null, label: "Tất cả" },
  { value: "TEXT", label: "Chữ" },
  { value: "IMAGE", label: "Ảnh" },
  { value: "COMPOSED", label: "Kết hợp" },
];

function formatDay(day: string): string {
  const [year, month, date] = day.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, date));
  const today = new Date();
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  if (day === todayKey) return `Hôm nay · ${day}`;
  return `Ngày ${parsed.getUTCDate()}/${parsed.getUTCMonth() + 1}/${parsed.getUTCFullYear()}`;
}

function formatTime(iso: string): string {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return iso;
  return parsed.toLocaleString("vi-VN", { hour: "2-digit", minute: "2-digit" });
}

function entrySummary(item: HistoryListItem): string {
  const refs = item.result_refs.length;
  if (item.mode === "TEXT") {
    return `“${item.query_text ?? ""}” · ${refs} kết quả`;
  }
  if (item.mode === "COMPOSED") {
    return item.query_text
      ? `Ảnh + “${item.query_text}” · ${refs} kết quả`
      : `Ảnh tải lên · ${refs} kết quả`;
  }
  return `Ảnh tải lên · ${refs} kết quả`;
}

export function HistoryList() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeMode = parseLibraryMode(searchParams.get("mode"));
  const requestIdRef = useRef(0);
  const [state, setState] = useState<PageState>({ status: "loading" });
  const [retryNonce, setRetryNonce] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    // Promise-chain style like the catalog browser: setState only inside
    // async continuations, never synchronously in the effect body.
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    readOwnProfile()
      .then((profile) => {
        if (requestIdRef.current !== requestId) return;
        if (!profile) {
          setState({ status: "denied" });
          router.replace("/dang-nhap?next=/tai-khoan/lich-su-tim-kiem");
          return;
        }
        const query = activeMode ? `?mode=${activeMode}&size=100` : "?size=100";
        return Promise.all([
          fetch(`/api/me/search-history${query}`, { cache: "no-store" }),
          fetch("/api/me/library-preferences", { cache: "no-store" }),
        ]).then(async ([historyResponse, prefsResponse]) => {
          if (requestIdRef.current !== requestId) return;
          if (historyResponse.status === 401 || prefsResponse.status === 401) {
            setState({ status: "denied" });
            router.replace("/dang-nhap?next=/tai-khoan/lich-su-tim-kiem");
            return;
          }
          if (!historyResponse.ok || !prefsResponse.ok) throw new Error("fetch failed");
          const history = (await historyResponse.json()) as {
            items: HistoryListItem[];
            total: number;
          };
          const prefs = (await prefsResponse.json()) as { record_history: boolean };
          if (requestIdRef.current !== requestId) return;
          setState({
            status: "ready",
            items: history.items,
            total: history.total,
            recording: prefs.record_history,
          });
        });
      })
      .catch(() => {
        if (requestIdRef.current !== requestId) return;
        setState({ status: "error", message: "Không tải được lịch sử. Hãy thử lại." });
      });
  }, [activeMode, router, retryNonce]);

  async function setRecording(next: boolean) {
    if (busy) return;
    setBusy("toggle");
    setNotice("");
    try {
      const csrf = await fetchCsrf();
      const response = await fetch("/api/me/library-preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", [csrf.header]: csrf.token },
        body: JSON.stringify({ record_history: next }),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      setState((prev) => (prev.status === "ready" ? { ...prev, recording: next } : prev));
      setNotice(
        next
          ? "Đã bật ghi lịch sử. Các lần tìm thành công kế tiếp sẽ được lưu."
          : "Đã tắt ghi lịch sử. Các mục hiện có được giữ lại cho đến khi bạn xóa hoặc hết hạn 30 ngày.",
      );
    } catch {
      setNotice("Đổi chế độ ghi không hoàn tất. Hãy thử lại.");
    } finally {
      setBusy(null);
    }
  }

  async function removeEntry(id: string) {
    if (busy) return;
    setBusy(id);
    setNotice("");
    try {
      const csrf = await fetchCsrf();
      const response = await fetch(`/api/me/search-history/${encodeURIComponent(id)}`, {
        method: "DELETE",
        headers: { [csrf.header]: csrf.token },
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      setState((prev) =>
        prev.status === "ready"
          ? { ...prev, items: prev.items.filter((item) => item.id !== id), total: prev.total - 1 }
          : prev,
      );
    } catch {
      setNotice("Xóa mục này không hoàn tất. Hãy thử lại.");
    } finally {
      setBusy(null);
    }
  }

  async function clearAll() {
    if (busy) return;
    setBusy("clear");
    setNotice("");
    try {
      const csrf = await fetchCsrf();
      const response = await fetch("/api/me/search-history", {
        method: "DELETE",
        headers: { [csrf.header]: csrf.token },
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      setState((prev) =>
        prev.status === "ready" ? { ...prev, items: [], total: 0 } : prev,
      );
      setConfirmClear(false);
      setNotice("Đã xóa toàn bộ lịch sử của bạn.");
    } catch {
      setNotice("Xóa toàn bộ không hoàn tất. Hãy thử lại.");
    } finally {
      setBusy(null);
    }
  }

  function switchMode(mode: LibraryMode | null) {
    const params = new URLSearchParams();
    if (mode) params.set("mode", mode);
    const query = params.toString();
    router.push(query ? `/tai-khoan/lich-su-tim-kiem?${query}` : "/tai-khoan/lich-su-tim-kiem", {
      scroll: false,
    });
  }

  if (state.status === "loading") {
    return (
      <div aria-live="polite" aria-label="Đang tải lịch sử tìm kiếm">
        <div className={styles.skeletonList} aria-hidden="true">
          {Array.from({ length: 3 }, (_, index) => (
            <span key={index} className={styles.skeleton} />
          ))}
        </div>
      </div>
    );
  }

  if (state.status === "denied") {
    return (
      <div className={styles.emptyBox}>
        <strong>Cần đăng nhập</strong>
        <span>Lịch sử tìm kiếm chỉ thuộc về tài khoản của chính bạn.</span>
        <Link className={accountStyles.secondary} href="/dang-nhap?next=/tai-khoan/lich-su-tim-kiem">
          Đăng nhập
        </Link>
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className={styles.errorBox} role="alert">
        <strong>Không tải được lịch sử</strong>
        <span>{state.message}</span>
        <button
          type="button"
          className={accountStyles.secondary}
          onClick={() => {
            setState({ status: "loading" });
            setRetryNonce((value) => value + 1);
          }}
        >
          Thử lại
        </button>
      </div>
    );
  }

  const groups = groupHistoryByDay(state.items);

  return (
    <div>
      <section className={styles.privacyCard} aria-label="Chế độ ghi lịch sử">
        <div>
          <strong>Ghi lịch sử: {state.recording ? "đang bật" : "đang tắt"}</strong>
          <p>
            Mặc định tắt. Chỉ khi bạn bật, các lần tìm thành công (chữ, ảnh, kết
            hợp) mới được lưu — tối đa 200 mục, 30 ngày. Ảnh tải lên không bao
            giờ được lưu; mục ảnh chỉ ghi “ảnh tải lên” kèm kết quả.
          </p>
        </div>
        <button
          type="button"
          className={accountStyles.secondary}
          disabled={busy === "toggle"}
          aria-pressed={state.recording}
          onClick={() => void setRecording(!state.recording)}
        >
          {busy === "toggle" ? "Đang đổi…" : state.recording ? "Tắt ghi lịch sử" : "Bật ghi lịch sử"}
        </button>
      </section>

      <div className={styles.chips} role="group" aria-label="Lọc theo chế độ tìm kiếm">
        {MODE_FILTERS.map((filter) => (
          <button
            key={filter.label}
            type="button"
            className={filter.value === activeMode ? `${styles.chip} ${styles.chipActive}` : styles.chip}
            aria-pressed={filter.value === activeMode}
            onClick={() => switchMode(filter.value)}
          >
            {filter.label}
          </button>
        ))}
      </div>

      {notice && (
        <p className={styles.notice} role="status">
          {notice}
        </p>
      )}

      {state.items.length === 0 ? (
        <div className={styles.emptyBox}>
          <strong>Chưa có lịch sử{activeMode ? ` cho chế độ ${modeLabel(activeMode)}` : ""}</strong>
          <span>
            {state.recording
              ? "Thực hiện một lần tìm kiếm thành công, mục mới sẽ xuất hiện tại đây."
              : "Bật ghi lịch sử ở trên, sau đó thực hiện tìm kiếm — mục mới sẽ xuất hiện tại đây."}
          </span>
        </div>
      ) : (
        <>
          <p className={styles.count} aria-live="polite">
            {state.total === 1 ? "1 mục." : `${state.total} mục.`}
          </p>
          {groups.map((group) => (
            <section key={group.day} aria-label={formatDay(group.day)}>
              <h2 className={styles.dayHeading}>{formatDay(group.day)}</h2>
              <ol className={styles.entries}>
                {group.items.map((item) => (
                  <li key={item.id} className={styles.entry}>
                    <div className={styles.entryMain}>
                      <span className={styles.modeBadge}>{modeLabel(item.mode)}</span>
                      <div>
                        <p className={styles.summary}>{entrySummary(item)}</p>
                        <p className={styles.entryMeta}>Lúc {formatTime(item.created_at)}</p>
                        <details className={styles.entryMeta}>
                          <summary>Chi tiết kỹ thuật</summary>
                          <span>
                            {item.catalog_snapshot_id} · {item.model_version} / {item.index_version}
                          </span>
                        </details>
                        {item.mode !== "TEXT" && (
                          <p className={styles.replayNote}>
                            Ảnh gốc không được lưu — tải lại ảnh để tìm lại chính xác.
                          </p>
                        )}
                      </div>
                    </div>
                    <div className={styles.entryActions}>
                      {item.mode === "TEXT" && item.query_text && (
                        <Link
                          className={styles.researchLink}
                          href={textResearchHref(item.query_text)}
                        >
                          Tìm lại
                        </Link>
                      )}
                      <button
                        type="button"
                        className={styles.removeButton}
                        disabled={busy === item.id}
                        onClick={() => void removeEntry(item.id)}
                        aria-label={`Xóa lịch sử ${entrySummary(item)}`}
                      >
                        {busy === item.id ? "Đang xóa…" : "Xóa"}
                      </button>
                    </div>
                  </li>
                ))}
              </ol>
            </section>
          ))}
          <div className={styles.clearRow}>
            {!confirmClear ? (
              <button
                type="button"
                className={styles.clearButton}
                disabled={state.items.length === 0}
                onClick={() => setConfirmClear(true)}
              >
                Xóa toàn bộ lịch sử
              </button>
            ) : (
              <div className={styles.confirmBox} role="alertdialog" aria-label="Xác nhận xóa toàn bộ">
                <strong>Xóa toàn bộ {state.total} mục? Không thể hoàn tác.</strong>
                <div className={styles.confirmActions}>
                  <button
                    type="button"
                    className={styles.clearButton}
                    disabled={busy === "clear"}
                    onClick={() => void clearAll()}
                  >
                    {busy === "clear" ? "Đang xóa…" : "Xác nhận xóa"}
                  </button>
                  <button
                    type="button"
                    className={accountStyles.secondary}
                    onClick={() => setConfirmClear(false)}
                  >
                    Giữ lại
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
