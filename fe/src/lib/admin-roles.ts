/** Quản trị viên (ADMIN) và Quản lý (STAFF) cùng dùng toàn bộ nghiệp vụ; chỉ tài khoản/vai trò là ADMIN. */
export const canManage = (role: string | null): boolean => role === "ADMIN" || role === "STAFF";
