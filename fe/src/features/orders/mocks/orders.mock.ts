import { Order } from '../types';

export const mockOrders: Order[] = [
  {
    id: 'ORD-2026-001',
    customerName: 'Nguyễn Văn A',
    customerPhone: '0912345678',
    total: 1250000,
    status: 'PENDING',
    date: '2026-10-08T10:30:00Z',
    itemsCount: 3,
    paymentMethod: 'COD'
  },
  {
    id: 'ORD-2026-002',
    customerName: 'Trần Thị B',
    customerPhone: '0987654321',
    total: 850000,
    status: 'PROCESSING',
    date: '2026-10-08T09:15:00Z',
    itemsCount: 2,
    paymentMethod: 'Ví điện tử'
  },
  {
    id: 'ORD-2026-003',
    customerName: 'Lê Minh C',
    customerPhone: '0901112223',
    total: 450000,
    status: 'SHIPPING',
    date: '2026-10-07T14:20:00Z',
    itemsCount: 1,
    paymentMethod: 'Thẻ tín dụng'
  },
  {
    id: 'ORD-2026-004',
    customerName: 'Phạm Văn D',
    customerPhone: '0933444555',
    total: 2100000,
    status: 'COMPLETED',
    date: '2026-10-06T16:45:00Z',
    itemsCount: 5,
    paymentMethod: 'COD'
  },
  {
    id: 'ORD-2026-005',
    customerName: 'Hoàng Thị E',
    customerPhone: '0977888999',
    total: 320000,
    status: 'CANCELLED',
    date: '2026-10-05T08:10:00Z',
    itemsCount: 1,
    paymentMethod: 'COD'
  }
];
