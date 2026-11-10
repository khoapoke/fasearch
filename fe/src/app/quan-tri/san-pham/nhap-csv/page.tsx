"use client";

import { FilePicker } from "@/components/admin-b/file-picker";
import Link from "next/link";
import { useRef, useState } from "react";
import { AdminShellB } from "@/components/admin-b/admin-shell";
import { ConfirmDialog } from "@/components/admin-b/confirm-dialog";
import { InfoHint } from "@/components/admin-b/info-hint";
import { PageHeader } from "@/components/admin-b/page-header";
import { RowLink } from "@/components/admin-b/row-link";
import { Num } from "@/components/admin-b/status-badge";
import { Pager } from "@/components/admin-b/pagination";
import { formatNumber } from "@/lib/admin-format";
import {
  IMPORT_HEADERS,
  IMPORT_MAX_ROWS,
  canApplyCsv,
  draftHref,
  fileFingerprint,
  importSummary,
  pagedImportErrors,
  precheckCsvFile,
  type CsvImportResult,
} from "@/lib/admin-csv-import";
import {
  CSV_IMPORT_TEMPLATE_URL,
  CsvImportApiError,
  applyCsvImport,
  dryRunCsvImport,
} from "@/lib/admin-csv-import-client";

function messageOf(failure: unknown): string {
  if (failure instanceof CsvImportApiError || failure instanceof Error) {
    return failure.message;
  }
  return "Máy chủ chưa xử lý được tệp CSV. Thử lại sau.";
}

/**
 * Product CSV import screen: download the template, choose a file, dry run ("Kiểm tra"), then
 * apply the very same file ("Nhập"). Imported rows always become drafts: nothing is published and
 * no stock is written. The created drafts open in the existing draft screen for review.
 */
export default function CsvImportPage() {
  const [file, setFile] = useState<File | null>(null);
  const [fingerprint, setFingerprint] = useState("");
  const [checking, setChecking] = useState(false);
  const [applying, setApplying] = useState(false);
  const [result, setResult] = useState<CsvImportResult | null>(null);
  const [checkedFingerprint, setCheckedFingerprint] = useState("");
  const [applied, setApplied] = useState<CsvImportResult | null>(null);
  const [message, setMessage] = useState("");
  const [errorPage, setErrorPage] = useState(0);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const ready = canApplyCsv(result, fingerprint, checkedFingerprint);
  const busy = checking || applying;
  const paged = result ? pagedImportErrors(result.errors, errorPage) : null;

  function choose(next: File | null) {
    setFile(next);
    setFingerprint(next ? fileFingerprint(next) : "");
    setResult(null);
    setApplied(null);
    setCheckedFingerprint("");
    setErrorPage(0);
    setMessage(next ? precheckCsvFile(next) ?? "" : "");
  }

  async function check() {
    if (!file || busy) return;
    const problem = precheckCsvFile(file);
    if (problem) {
      setResult(null);
      setCheckedFingerprint("");
      setMessage(problem);
      return;
    }
    setChecking(true);
    setMessage("");
    setApplied(null);
    try {
      const fresh = await dryRunCsvImport(file);
      setResult(fresh);
      setCheckedFingerprint(fileFingerprint(file));
      setErrorPage(0);
    } catch (failure) {
      setResult(null);
      setCheckedFingerprint("");
      setMessage(messageOf(failure));
    } finally {
      setChecking(false);
    }
  }

  async function confirmApply() {
    if (!file || !result || !ready || applying) return;
    setConfirmOpen(false);
    setApplying(true);
    setMessage("");
    try {
      const done = await applyCsvImport(file, result.checksum);
      setApplied(done);
      setCheckedFingerprint("");
    } catch (failure) {
      setMessage(messageOf(failure));
    } finally {
      setApplying(false);
    }
  }

  const step = applied ? 4 : ready ? 3 : file ? 2 : 1;
  const steps = [
    { n: 1, label: "Tải mẫu" },
    { n: 2, label: "Kiểm tra" },
    { n: 3, label: "Import" },
  ];

  return (
    <AdminShellB active="products" title="Sản phẩm" eyebrow="Vận hành · sản phẩm">
      <Link className="back-link" href="/quan-tri/san-pham">← Về danh sách sản phẩm</Link>
      <PageHeader
        title="Import CSV sản phẩm"
        hint={<>Tạo Draft sản phẩm từ tệp CSV, chưa Publish, không nhập tồn kho, không đồng bộ AI. Tệp UTF-8, dấu phẩy, tối đa 5 MB và {formatNumber(IMPORT_MAX_ROWS)} dòng, đủ {IMPORT_HEADERS.length} cột: {IMPORT_HEADERS.join(", ")}. Danh mục và thương hiệu phải có sẵn; hệ thống không tự tạo. Mỗi dòng là một SKU; các dòng cùng sản phẩm gộp vào một Draft.</>}
        actions={<a className="secondary" href={CSV_IMPORT_TEMPLATE_URL}>Tải tệp mẫu</a>}
      />

      <ol className="csv-steps" aria-label="Các bước Import">
        {steps.map((st) => (
          <li key={st.n} className={st.n < step ? "done" : st.n === step ? "current" : ""} aria-current={st.n === step ? "step" : undefined}>
            <span className="csv-step-dot" aria-hidden="true">{st.n < step ? "✓" : st.n}</span>{st.label}
          </li>
        ))}
      </ol>

      <section className="workbench csv-pick" aria-label="Chọn tệp CSV">
        <div className="csv-pick-row">
          <div className="catalog-field">
            <label htmlFor="csv-file">Tệp CSV</label>
            <FilePicker
              id="csv-file"
              inputRef={inputRef}
              accept=".csv,text/csv"
              disabled={busy}
              onChange={(event) => {
                choose(event.target.files?.[0] ?? null);
              }}
            />
            <p className="meta" role="status" aria-live="polite">
              {file ? `Đã chọn ${file.name} (${formatNumber(file.size)} byte).` : null}
            </p>
          </div>
          <div className="catalog-actions">
            <button className="secondary" type="button" disabled={!file || busy} aria-busy={checking} onClick={() => void check()}>
              {checking ? "Đang kiểm tra…" : "Kiểm tra"}
            </button>
            <button
              className="primary"
              type="button"
              disabled={!ready || busy}
              aria-disabled={!ready || busy}
              title={ready ? "Import tệp đã kiểm tra" : "Chỉ Import sau khi Kiểm tra sạch cùng tệp này"}
              onClick={() => setConfirmOpen(true)}
            >
              {applying ? "Đang Import…" : "Import"}
            </button>
            {file ? (
              <button
                className="secondary"
                type="button"
                disabled={busy}
                onClick={() => {
                  if (inputRef.current) inputRef.current.value = "";
                  choose(null);
                }}
              >
                Chọn tệp khác
              </button>
            ) : null}
          </div>
        </div>
        {file && !ready && !applied ? <p className="meta">Kiểm tra sạch cùng tệp hiện tại để mở nút Import.</p> : null}
        {message ? <p className="catalog-error" role="alert">{message}</p> : null}
      </section>

      {result ? (
        <section className="workbench" aria-label="Kết quả kiểm tra tệp CSV">
          <div className="pd-sku-head">
            <h2>Kết quả kiểm tra<InfoHint>{importSummary(result)} Dòng 1 là dòng tiêu đề. Tệp có lỗi không ghi dòng nào.</InfoHint></h2>
          </div>
          <dl className="csv-import-counts">
            <div><dt>Tổng dòng</dt><dd><Num tone="blue" value={result.totalRows} unit="" /></dd></div>
            <div><dt>Hợp lệ</dt><dd><Num tone="green" value={result.validRows} unit="" /></dd></div>
            <div><dt>Sản phẩm</dt><dd><Num tone="blue" value={result.productCount} unit="" /></dd></div>
            <div><dt>Lỗi</dt><dd><Num tone="red" value={result.errorCount} unit="" /></dd></div>
          </dl>

          {result.errorCount > 0 ? (
            <>
              {result.truncated ? (
                <p className="meta" role="status">Tệp có nhiều lỗi hơn mức hiển thị; bảng dưới đây chỉ có 200 lỗi đầu tiên.</p>
              ) : null}
              <div className="table-scroll sticky-head review-table-scroll table-cards" tabIndex={0} aria-label="Danh sách lỗi trong tệp CSV">
                <table className="review-orders-table fit-table">
                  <caption className="sr-only">Lỗi trong tệp CSV</caption>
                  <thead><tr><th className="num">Dòng</th><th>Cột</th><th>Lỗi</th></tr></thead>
                  <tbody>
                    {(paged?.rows ?? []).map((error, index) => (
                      <tr key={`${error.row}-${error.column}-${index}`}>
                        <td data-label="Dòng" className="num">{error.row}</td>
                        <td data-label="Cột">{error.column || "Toàn dòng"}</td>
                        <td data-label="Lỗi" className="t-red">{error.message}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {paged && paged.totalPages > 1 ? (
                <Pager page={paged.page} totalPages={paged.totalPages} total={result.errorCount} unit="lỗi" onPage={setErrorPage} />
              ) : null}
            </>
          ) : (
            <p className="csv-ok t-green" role="status">
              Tệp hợp lệ. Bấm Import để tạo {formatNumber(result.productCount)} Draft.
            </p>
          )}
        </section>
      ) : null}

      {applied ? (
        <section className="workbench" aria-label="Draft đã tạo">
          <div className="pd-sku-head">
            <h2>Đã tạo {formatNumber(applied.drafts?.length ?? applied.productCount)} Draft<InfoHint>Chưa Publish, chưa có tồn kho và chưa đồng bộ AI. Mở từng Draft để thêm ảnh rồi Publish theo quy trình thường.</InfoHint></h2>
            <Link className="secondary btn-sm" href="/quan-tri/san-pham">Về danh sách sản phẩm</Link>
          </div>
          {applied.drafts && applied.drafts.length > 0 ? (
            <div className="table-scroll sticky-head review-table-scroll table-cards" tabIndex={0} aria-label="Draft vừa tạo">
              <table className="review-orders-table fit-table">
                <caption className="sr-only">Draft vừa tạo</caption>
                <thead><tr><th>Mã Draft</th><th>Sản phẩm</th><th className="num">SKU</th><th className="num">Thao tác</th></tr></thead>
                <tbody>
                  {applied.drafts.map((draft) => (
                    <RowLink key={draft.draftId} href={draftHref(draft.draftId)}>
                      <td data-label="Mã Draft" className="cell-date">#{draft.draftId}</td>
                      <td data-label="Sản phẩm" className="cell-title"><Link className="pl-name" href={draftHref(draft.draftId)}>{draft.productName}</Link></td>
                      <td data-label="SKU" className="num"><Num tone="blue" value={draft.skuCount} unit="" /></td>
                      <td data-label="Thao tác" className="num"><Link className="secondary btn-sm" href={draftHref(draft.draftId)}>Mở Draft</Link></td>
                    </RowLink>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="meta">Không có Draft mới.</p>
          )}
        </section>
      ) : null}

      <ConfirmDialog
        open={confirmOpen && result !== null}
        title="Xác nhận Import CSV"
        message={result ? `Tạo ${formatNumber(result.productCount)} Draft từ ${formatNumber(result.validRows)} dòng hợp lệ. Các Draft chưa Publish, chưa hiển thị với khách hàng và không nhập tồn kho (tồn kho đi qua phiếu nhập).` : ""}
        confirmLabel={result ? `Import ${formatNumber(result.productCount)} Draft` : "Import"}
        busy={applying}
        onConfirm={() => void confirmApply()}
        onClose={() => { if (!applying) setConfirmOpen(false); }}
      />
    </AdminShellB>
  );
}
