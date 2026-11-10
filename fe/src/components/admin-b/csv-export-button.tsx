"use client";

import { useState } from "react";
import { downloadCsvExport } from "@/lib/admin-csv-client";
import { personalDataNotice, type CsvDataset } from "@/lib/admin-csv";
import { useAdminCan } from "./use-admin-role";

/**
 * "Xuất CSV" for an admin list. It sends the current search and filters to the BFF, shows a
 * busy state while the file streams, and never offers the same download twice at once.
 * Customer and order exports ask for confirmation because the file contains personal data.
 */
export function CsvExportButton({
  dataset,
  query,
  confirm = false,
}: {
  dataset: CsvDataset;
  query: string;
  confirm?: boolean;
}) {
  const can = useAdminCan();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState("");

  const path = `/api/admin/csv/${dataset}${query ? `?${query}` : ""}`;

  async function run() {
    if (busy) return;
    setBusy(true);
    setError("");
    setDone("");
    try {
      const filename = await downloadCsvExport(path, dataset);
      setDone(filename);
      setOpen(false);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Không xuất được CSV.");
    } finally {
      setBusy(false);
    }
  }

  function start() {
    if (busy) return;
    setError("");
    setDone("");
    if (confirm) {
      setOpen(true);
      return;
    }
    void run();
  }

  // Export cần quyền Export CSV và quyền xem đúng dữ liệu đó (BE kiểm tra cả hai).
  const VIEW = { products: "PRODUCT_VIEW", stock: "INVENTORY_VIEW", orders: "ORDER_VIEW", customers: "CUSTOMER_VIEW" } as const;
  if (!can("DATA_EXPORT") || !can(VIEW[dataset])) return null;

  return (
    <div className="csv-export">
      <button className="secondary" type="button" disabled={busy} aria-busy={busy} onClick={start}>
        {busy ? "Đang export…" : "Export CSV"}
      </button>
      {error ? <p className="catalog-error" role="alert">{error}</p> : null}
      {done && !open ? <p className="meta" role="status">Đã tải {done}.</p> : null}
      {open ? (
        <div className="csv-export-backdrop">
          <section className="workbench csv-export-dialog" role="dialog" aria-modal="true" aria-labelledby="csv-export-title">
            <div className="section-head">
              <div>
                <h2 id="csv-export-title">Xác nhận Export CSV</h2>
                <p className="meta">Tệp được tạo từ đúng bộ lọc đang áp dụng, gồm mọi dòng khớp.</p>
              </div>
              <button className="icon-btn" type="button" aria-label="Đóng hộp thoại Export CSV" onClick={() => setOpen(false)} disabled={busy}>
                ✕
              </button>
            </div>
            <p className="meta">{personalDataNotice(dataset === "orders" ? "orders" : "customers")}</p>
            {error ? <p className="catalog-error" role="alert">{error}</p> : null}
            <div className="catalog-actions" style={{ flexWrap: "wrap" }}>
              <button className="secondary" type="button" disabled={busy} aria-busy={busy} onClick={() => void run()}>
                {busy ? "Đang export…" : "Tải tệp CSV"}
              </button>
              <button className="secondary" type="button" onClick={() => setOpen(false)} disabled={busy}>
                Hủy
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}
