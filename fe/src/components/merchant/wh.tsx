"use client";

import Link from "next/link";
import { whReadError, type WhError } from "@/lib/wh-client";

export function WhErrorBox({ error }: { error: WhError | null }) {
  if (!error) return null;
  return (
    <div className="mpPreviewBar flash-in" data-fresh role="alert" style={error.status >= 500 ? { background: "#fef2f2", borderColor: "#fecaca", color: "#991b1b" } : undefined}>
      <span>
        <b>Lỗi {error.status}: </b>
        {error.message}
        {error.errors.length > 0 ? (
          <span> ({error.errors.map((e) => `${e.field}: ${e.reason}`).join("; ")})</span>
        ) : null}
      </span>
    </div>
  );
}

export async function toWhError(response: Response): Promise<WhError> {
  return whReadError(response);
}

export function WhAuthNote({ role }: { role: string | null }) {
  if (role === "ADMIN" || role === "STAFF") return null;
  return (
    <p className="mpPreviewBar" role="note">
      <span>
        {role
          ? "Tài khoản của bạn là CUSTOMER — các thao tác kho cần STAFF/ADMIN. Bảng dưới sẽ báo 403 trung thực."
          : "Bạn chưa đăng nhập — quản lý kho cần phiên STAFF/ADMIN. "}
        <Link href="/dang-nhap" style={{ fontWeight: 700 }}>Đăng nhập →</Link>
      </span>
    </p>
  );
}
