export type InternalAccount = { id: number; customerId?: number | null; username: string; email: string; role: string; status: string; createdAt: string };
export type Employee = { id: number; firstName: string | null; lastName: string; avatar: string | null; gender: string | null; phoneNumber: string; cccd: string; dob: string | null; address: string | null; accountId: number | null; username: string | null; role: string | null };
export type Page<T> = { content: T[]; pageNumber: number; pageSize: number; totalElements: number; totalPages: number; last: boolean };
export class PeopleError extends Error { status: number; code: string; constructor(message: string, status: number, code = "PEOPLE_ERROR") { super(message); this.name = "PeopleError"; this.status = status; this.code = code; } }
type Envelope<T> = { success?: boolean; message?: string; code?: string; result?: T };
async function parse<T>(r: Response): Promise<T> { let j: Envelope<T> | null = null; try { j = await r.json(); } catch {} if (!r.ok || j?.success !== true || j.result === undefined) throw new PeopleError(j?.message || "Yêu cầu nhân sự thất bại.", r.status || 502, j?.code); return j.result; }
export const getAccountPage = async (q: string, signal?: AbortSignal) => parse<Page<InternalAccount>>(await fetch(`/api/admin/accounts?${q}`, { cache: "no-store", signal }));
export const createAccount = async (body: Record<string, unknown>) => parse<InternalAccount>(await fetch("/api/admin/accounts", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }));
export const updateAccount = async (id: number, body: Record<string, unknown>) => parse<InternalAccount>(await fetch(`/api/admin/accounts/${id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }));
export const getEmployeePage = async (q: string, signal?: AbortSignal) => parse<Page<Employee>>(await fetch(`/api/admin/employees?${q}`, { cache: "no-store", signal }));
export const getEmployee = async (id: string, signal?: AbortSignal) => parse<Employee>(await fetch(`/api/admin/employees/${id}`, { cache: "no-store", signal }));
export const createEmployee = async (body: Record<string, unknown>) => parse<Employee>(await fetch("/api/admin/employees", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }));
export const updateEmployee = async (id: string, body: Record<string, unknown>) => parse<Employee>(await fetch(`/api/admin/employees/${id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }));
export const roleLabel = (v: string | null) => v === "ADMIN" ? "Quản trị" : v === "STAFF" ? "Nhân viên" : v === "CUSTOMER" ? "Khách hàng" : v ?? "—";
export const statusLabel = (v: string) => v === "ACTIVE" ? "Hoạt động" : v === "INACTIVE" ? "Chưa hoạt động" : v === "LOCKED" ? "Đã khóa" : v === "DELETED" ? "Đã xóa" : v;
export const genderLabel = (v: string | null) => v === "MALE" ? "Nam" : v === "FEMALE" ? "Nữ" : v === "OTHER" ? "Khác" : "—";
export const maskCccd = (v: string) => v.length === 12 ? `••••••••${v.slice(-4)}` : "—";
