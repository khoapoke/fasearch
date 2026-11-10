export type BoundedJsonResult =
  | { ok: true; body: Record<string, unknown> }
  | { ok: false; reason: "TOO_LARGE" | "INVALID" };

export async function readBoundedJsonObject(request: Request, maxBytes: number): Promise<BoundedJsonResult> {
  const declared = Number(request.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > maxBytes) return { ok: false, reason: "TOO_LARGE" };
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 1 || !request.body) return { ok: false, reason: "INVALID" };

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) {
        try { await reader.cancel(); } catch { /* size limit remains decisive */ }
        return { ok: false, reason: "TOO_LARGE" };
      }
      chunks.push(value);
    }
  } catch {
    return { ok: false, reason: "INVALID" };
  } finally {
    reader.releaseLock();
  }

  try {
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    const parsed: unknown = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return { ok: false, reason: "INVALID" };
    const prototype = Object.getPrototypeOf(parsed);
    if (prototype !== Object.prototype && prototype !== null) return { ok: false, reason: "INVALID" };
    return { ok: true, body: parsed as Record<string, unknown> };
  } catch {
    return { ok: false, reason: "INVALID" };
  }
}
