export type Customer = { id: number; firstName: string | null; lastName: string; gender: string | null; phoneNumber: string; dob: string | null; address: string | null; accumulatePoint: number; tierId: number | null; tierName: string | null };
export type Page<T> = { content: T[]; pageNumber: number; pageSize: number; totalElements: number; totalPages: number; last: boolean };
export class CustomerAdminError extends Error { status: number; code: string; constructor(message: string, status: number, code = "CUSTOMER_ADMIN_ERROR") { super(message); this.name = "CustomerAdminError"; this.status = status; this.code = code; } }
type Envelope<T> = { success?: boolean; message?: string; code?: string; result?: T };
async function parse<T>(r: Response): Promise<T> { let j: Envelope<T> | null = null; try { j = await r.json(); } catch {} if (!r.ok || j?.success !== true || j.result === undefined) throw new CustomerAdminError(j?.message || "Yêu cầu khách hàng thất bại.", r.status || 502, j?.code); return j.result; }
export const getCustomerPage = async (q: string, signal?: AbortSignal) => parse<Page<Customer>>(await fetch(`/api/admin/customers?${q}`, { cache: "no-store", signal }));
export const getCustomer = async (id: string, signal?: AbortSignal) => parse<Customer>(await fetch(`/api/admin/customers/${id}`, { cache: "no-store", signal }));
export const createCustomer = async (body: Record<string, unknown>) => parse<Customer>(await fetch("/api/admin/customers", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }));
export const updateCustomer = async (id: string, body: Record<string, unknown>) => parse<Customer>(await fetch(`/api/admin/customers/${id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }));
export const genderLabel = (v: string | null) => v === "MALE" ? "Nam" : v === "FEMALE" ? "Nữ" : v === "OTHER" ? "Khác" : "—";
