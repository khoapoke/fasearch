// Shared account session helpers (client). Thin fetch wrappers; the backend
// stays authoritative for validation and auth decisions. All payloads use the
// BE ApiResponse envelope: { success, code, message, result, errors }.

type Envelope<T> = {
  success: boolean;
  code: number;
  message: string;
  result: T;
  errors?: Array<{ field: string; reason: string }>;
};

function unwrap<T>(payload: unknown): T {
  const envelope = payload as Envelope<T>;
  if (!envelope || typeof envelope !== "object" || !("result" in envelope)) {
    throw new Error("Định dạng phản hồi không đúng.");
  }
  return envelope.result;
}

export type AccountIdentity = {
  id: number;
  username: string;
  email: string;
  role: string;
  authenticated: boolean;
};

export async function readOwnIdentity(): Promise<AccountIdentity | null> {
  const response = await fetch("/api/auth/me", { cache: "no-store" });
  if (response.status === 401) return null;
  if (!response.ok) throw new Error("Không thể tải thông tin phiên.");
  return unwrap<AccountIdentity>(await response.json());
}
