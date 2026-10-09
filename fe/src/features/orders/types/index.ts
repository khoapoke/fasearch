export type OrderStatus = 'PENDING' | 'PROCESSING' | 'SHIPPING' | 'COMPLETED' | 'CANCELLED';

export interface Order {
  id: string;
  customerName: string;
  customerPhone: string;
  total: number;
  status: OrderStatus;
  date: string;
  itemsCount: number;
  paymentMethod: string;
}
