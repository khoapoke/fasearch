export type CustomerProfile = { id: number; deliveryLatitude?: number | null; deliveryLongitude?: number | null; firstName: string | null; lastName: string; gender: string | null; phoneNumber: string; dob: string | null; address: string | null; accumulatePoint: number; tierId: number | null; tierName: string | null };
export class ProfileError extends Error { status: number; code: string; constructor(message: string, status: number, code = "PROFILE_ERROR") { super(message); this.name = "ProfileError"; this.status = status; this.code = code; } }
type Envelope<T> = { success?: boolean; message?: string; code?: string; result?: T };
async function parse<T>(r: Response): Promise<T> { let j: Envelope<T> | null = null; try { j = await r.json(); } catch {} if (!r.ok || j?.success !== true || j.result === undefined) throw new ProfileError(j?.message || "Không tải được hồ sơ.", r.status || 502, j?.code); return j.result; }
export const getSelfProfile = async (signal?: AbortSignal) => parse<CustomerProfile>(await fetch("/api/customer-profile", { cache: "no-store", signal }));
export const updateSelfProfile = async (body: Record<string, unknown>) => parse<CustomerProfile>(await fetch("/api/customer-profile", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }));
export const profileGenderLabel = (v: string | null) => v === "MALE" ? "Nam" : v === "FEMALE" ? "Nữ" : v === "OTHER" ? "Khác" : "—";

/** Họ (firstName, cột ho_kh) + Tên (lastName, cột ten_kh). Dùng chung cho mọi mặt khách hàng. */
export function customerFullName(p: { firstName?: string | null; lastName?: string | null } | null | undefined): string {
  if (!p) return "";
  return [p.firstName, p.lastName].filter(Boolean).join(" ").trim();
}
