import { User } from '../types';

export const MOCK_USERS: (User & { password: string })[] = [
  {
    id: 'u1',
    name: 'Khách Hàng Demo',
    email: 'user@fasearch.vn',
    password: '123',
    role: 'CUSTOMER',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=60',
  },
  {
    id: 'm1',
    name: 'Trần Quản Lý',
    email: 'manager@fasearch.vn',
    password: '123',
    role: 'MANAGER',
    avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&auto=format&fit=crop&q=60',
  },
  {
    id: 'a1',
    name: 'Lê Quản Trị',
    email: 'admin@fasearch.vn',
    password: '123',
    role: 'ADMIN',
    avatar: 'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=100&auto=format&fit=crop&q=60',
  },
];
