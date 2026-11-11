export type NotificationPreference = { orderUpdates: boolean };
export type FavoriteAlert = { productId: number; stockAlert: boolean; priceAlert: boolean; availableStock: number };
export type BellItem = { id: number; title: string; href: string; permission: "ORDER_VIEW" | "RETURN_VIEW" | "INVENTORY_VIEW"; createdAt: string; read: boolean };
export type BellResult = { unreadCount: number; items: BellItem[] };
export async function notificationApi<T>(url: string, body?: unknown, method: "PUT" | "POST" = "PUT", signal?: AbortSignal): Promise<T> {
  const response = await fetch(url, { method: body === undefined ? "GET" : method, cache: "no-store", signal,
    headers: body === undefined ? undefined : { "content-type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
  const payload = await response.json();
  if (!response.ok || payload.success !== true) throw new Error(payload.message || "Không xử lý được thông báo. Vui lòng thử lại.");
  return payload.result as T;
}
