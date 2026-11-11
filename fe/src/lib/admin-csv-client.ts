"use client";

import { csvFilename, filenameFromDisposition, type CsvDataset } from "@/lib/admin-csv";

export class CsvExportError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "CsvExportError";
    this.status = status;
  }
}

/**
 * Download a CSV through the BFF. The server streams the rows and sends the file name;
 * a refusal (cap, role) arrives as a JSON envelope and is surfaced as an error.
 */
export async function downloadCsvExport(path: string, dataset: CsvDataset): Promise<string> {
  let response: Response;
  try {
    response = await fetch(path, { cache: "no-store" });
  } catch {
    throw new CsvExportError("Không kết nối được máy chủ để Export CSV.", 0);
  }
  if (!response.ok) {
    let message = "Export CSV thất bại. Thử lại sau.";
    try {
      const payload = await response.json() as { message?: string };
      if (payload?.message) message = payload.message;
    } catch {
      // Keep the generic message when the body is not JSON.
    }
    throw new CsvExportError(message, response.status);
  }
  const filename = filenameFromDisposition(response.headers.get("content-disposition"))
    ?? csvFilename(dataset);
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  return filename;
}
