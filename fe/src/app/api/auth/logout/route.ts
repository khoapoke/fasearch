export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Proxy cũ của phiên dựa trên CSRF/cookie đã ngừng: BE là JWT-only và không còn
// /api/v1/auth/logout. Dùng /api/customer-auth/* (đăng xuất xóa cookie tại BFF).
function gone(): Response {
  return Response.json(
    { success: false, code: 410, message: "Route xác thực cũ đã ngừng. Dùng các BFF xác thực tích hợp.", result: null },
    { status: 410, headers: { "cache-control": "no-store" } },
  );
}
export async function POST() { return gone(); }
