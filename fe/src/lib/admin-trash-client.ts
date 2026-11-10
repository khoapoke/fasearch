/** Thùng rác: chỉ đọc và khôi phục. Không có lời gọi xóa vĩnh viễn nào ở client. */

export type TrashKind = "products" | "variants" | "categories" | "customers" | "employees" | "accounts";

export type TrashItem = {
  id: number;
  name: string | null;
  status: string | null;
  publicationStatus: string | null;
  productId: number | null;
  productName: string | null;
  color: string | null;
  size: string | null;
  barcode: string | null;
  parentDeleted: boolean;
  /** Tab khách hàng/nhân sự: số điện thoại như danh sách hiện có. */
  phone: string | null;
  /** Tab tài khoản: email và vai trò như danh sách tài khoản hiện có. */
  email: string | null;
  role: string | null;
  /** Tab khách hàng/nhân sự: tài khoản đăng nhập liên kết (nếu có) và trạng thái của nó. */
  linkedUsername: string | null;
  linkedAccountStatus: string | null;
  deletedAt: string | null;
  /** null khi dòng được xóa trước khi hệ thống ghi nhận người xóa. */
  deletedBy: string | null;
  deleteReason: string | null;
};

export type TrashPage = {
  content: TrashItem[];
  pageNumber: number;
  pageSize: number;
  totalElements: number;
  totalPages: number;
  last: boolean;
};

export class TrashAdminError extends Error {
  status: number;
  code: number;
  constructor(message: string, status: number, code = 0) {
    super(message);
    this.name = "TrashAdminError";
    this.status = status;
    this.code = code;
  }
}

type Envelope<T> = { success?: boolean; message?: string; code?: number; result?: T };

async function parse<T>(response: Response): Promise<T> {
  let body: Envelope<T> | null = null;
  try {
    body = (await response.json()) as Envelope<T>;
  } catch {
    body = null;
  }
  if (!response.ok || body?.success !== true) {
    throw new TrashAdminError(body?.message || "Yêu cầu thùng rác thất bại.", response.status || 502, Number(body?.code ?? 0));
  }
  return body.result as T;
}

export async function getTrashPage(kind: TrashKind, page: number, size = 20, signal?: AbortSignal): Promise<TrashPage> {
  return parse<TrashPage>(
    await fetch(`/api/admin/trash/${kind}?page=${Math.max(0, page)}&size=${size}`, { cache: "no-store", signal }),
  );
}

export async function restoreTrashItem(kind: TrashKind, id: number): Promise<boolean> {
  return parse<boolean>(
    await fetch(`/api/admin/trash/${kind}/${id}/restore`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    }),
  );
}

/** Người xóa rỗng được hiển thị là hệ thống; không bao giờ hiển thị id thô. */
export function deletedByLabel(value: string | null): string {
  const trimmed = value?.trim();
  return trimmed ? trimmed : "Hệ thống";
}
