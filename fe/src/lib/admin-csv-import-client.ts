import type { CsvImportResult } from "@/lib/admin-csv-import";

export class CsvImportApiError extends Error {
  status: number;
  constructor(message: string, status = 0) {
    super(message);
    this.name = "CsvImportApiError";
    this.status = status;
  }
}

type Envelope = { success?: boolean; message?: string; result?: CsvImportResult };

async function parse(response: Response): Promise<CsvImportResult> {
  let payload: Envelope | null = null;
  try {
    payload = (await response.json()) as Envelope;
  } catch {
    payload = null;
  }
  if (!response.ok || payload?.success !== true || !payload.result) {
    throw new CsvImportApiError(
      payload?.message || "Máy chủ chưa xử lý được tệp CSV. Thử lại sau.",
      response.status || 502,
    );
  }
  return payload.result;
}

/** Validate only: the server writes nothing and returns the checksum used by apply. */
export async function dryRunCsvImport(file: File, signal?: AbortSignal): Promise<CsvImportResult> {
  const form = new FormData();
  form.append("file", file);
  return parse(await fetch("/api/admin/csv/products/import?dryRun=true", {
    method: "POST",
    body: form,
    cache: "no-store",
    signal,
  }));
}

/** Apply the same file the dry run approved; the checksum rejects a changed file server-side. */
export async function applyCsvImport(
  file: File,
  checksum: string,
  signal?: AbortSignal,
): Promise<CsvImportResult> {
  const form = new FormData();
  form.append("file", file);
  return parse(await fetch(`/api/admin/csv/products/import?checksum=${encodeURIComponent(checksum)}`, {
    method: "POST",
    body: form,
    cache: "no-store",
    signal,
  }));
}

export const CSV_IMPORT_TEMPLATE_URL = "/api/admin/csv/products/template";
