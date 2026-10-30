import { OrderDetailClient } from "@/components/admin-b/order-detail";
export const metadata = { title: "Chi tiết đơn | FaSearch Admin" };
export default async function AdminOrderDetailPage({ params }: { params: Promise<{ id: string }> }) { const { id } = await params; return <OrderDetailClient id={id} />; }
