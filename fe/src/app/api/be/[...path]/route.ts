export const runtime = "nodejs";
export const dynamic = "force-dynamic";
function gone() { return Response.json({ success: false, code: 410, message: "Legacy proxy đã ngừng trong integrated demo. Dùng các BFF tích hợp.", result: null }, { status: 410, headers: { "cache-control": "no-store" } }); }
export async function GET() { return gone(); }
export async function POST() { return gone(); }
export async function PUT() { return gone(); }
export async function PATCH() { return gone(); }
export async function DELETE() { return gone(); }
