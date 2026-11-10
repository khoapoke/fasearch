export const NEXT_STEP: Record<string, { target: string; label: string; title: string }> = {
  PENDING: { target: "CONFIRMED", label: "Xác nhận", title: "Xác nhận đơn hàng" },
  CONFIRMED: { target: "PACKING", label: "Đóng gói", title: "Chuyển sang đóng gói" },
  PACKING: { target: "SHIPPING", label: "Giao hàng", title: "Chuyển sang đang giao" },
  SHIPPING: { target: "COMPLETED", label: "Hoàn tất", title: "Hoàn tất đơn hàng" },
};
export function eligibleBulkStep(orders: { status: string; paymentStatus: string | null }[]) {
  if (!orders.length || orders.some((order) => order.status !== orders[0].status || (order.status === "SHIPPING" && order.paymentStatus !== "PAID"))) return undefined;
  return NEXT_STEP[orders[0].status];
}
export async function processBulk<T>(orders: T[], update: (order: T) => Promise<unknown>, failure: (order: T, error: unknown) => string) {
  let success = 0; const errors: string[] = [];
  for (const order of orders) {
    try { await update(order); success++; } catch (error) { errors.push(failure(order, error)); }
  }
  return { success, errors };
}
