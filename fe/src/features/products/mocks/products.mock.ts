import { Product } from '../types';

export const mockProducts: Product[] = [
  {
    id: 'p1',
    name: 'Áo Thun Nam Cổ Tròn Basic Cotton 100% Phom Khỏe Khoắn',
    price: 150000,
    originalPrice: 200000,
    discountPercent: 25,
    imageUrl: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?ixlib=rb-4.0.3&auto=format&fit=crop&w=500&q=80',
    images: [
      'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?ixlib=rb-4.0.3&auto=format&fit=crop&w=1000&q=80',
      'https://images.unsplash.com/photo-1583743814966-8936f5b7be1a?ixlib=rb-4.0.3&auto=format&fit=crop&w=1000&q=80'
    ],
    category: 'Áo Nam',
    inStock: true,
    rating: 4.8,
    reviewsCount: 124,
    isNew: true,
    description: 'Áo thun basic làm từ 100% cotton tự nhiên, thấm hút mồ hôi tốt. Kiểu dáng đơn giản, dễ phối đồ.',
    sizes: ['S', 'M', 'L', 'XL'],
    colors: [
      { name: 'Trắng', hex: '#FFFFFF' },
      { name: 'Đen', hex: '#111827' },
      { name: 'Xám', hex: '#9CA3AF' }
    ]
  },
  {
    id: 'p2',
    name: 'Đầm Váy Nữ Dáng Dài Trễ Vai Vintage Tiểu Thư',
    price: 350000,
    imageUrl: 'https://images.unsplash.com/photo-1572804013309-59a88b7e92f1?ixlib=rb-4.0.3&auto=format&fit=crop&w=500&q=80',
    images: [
      'https://images.unsplash.com/photo-1572804013309-59a88b7e92f1?ixlib=rb-4.0.3&auto=format&fit=crop&w=1000&q=80'
    ],
    category: 'Váy Nữ',
    inStock: true,
    rating: 4.9,
    reviewsCount: 89,
    description: 'Thiết kế cổ trễ khoe trọn xương quai xanh quyến rũ. Chất liệu voan lụa mềm mại, bay bổng. Tone màu pastel tôn da.',
    sizes: ['S', 'M', 'L'],
    colors: [
      { name: 'Hồng nhạt', hex: '#FBCFE8' },
      { name: 'Trắng', hex: '#FFFFFF' }
    ]
  },
  {
    id: 'p3',
    name: 'Áo Khoác Bomber Unisex Vải Dù Chống Nước',
    price: 450000,
    originalPrice: 600000,
    discountPercent: 25,
    imageUrl: 'https://images.unsplash.com/photo-1551028719-00167b16eac5?ixlib=rb-4.0.3&auto=format&fit=crop&w=500&q=80',
    category: 'Áo Khoác',
    inStock: false,
    rating: 4.5,
    reviewsCount: 56,
  },
  {
    id: 'p4',
    name: 'Quần Jean Nữ Ống Rộng Phong Cách Hàn Quốc Y2K',
    price: 280000,
    imageUrl: 'https://images.unsplash.com/photo-1542272604-787c3835535d?ixlib=rb-4.0.3&auto=format&fit=crop&w=500&q=80',
    category: 'Quần Nữ',
    inStock: true,
    rating: 4.7,
    reviewsCount: 210,
    isNew: true,
    description: 'Form quần ống rộng cạp cao hack dáng cực đỉnh. Chất jean cotton mềm mịn.',
    sizes: ['S', 'M', 'L', 'XL'],
    colors: [
      { name: 'Xanh nhạt', hex: '#93C5FD' },
      { name: 'Xanh đậm', hex: '#1E3A8A' }
    ]
  },
  {
    id: 'p5',
    name: 'Áo Sơ Mi Nam Công Sở Vải Linen Thoáng Mát',
    price: 320000,
    imageUrl: 'https://images.unsplash.com/photo-1596755094514-f87e32f85e23?ixlib=rb-4.0.3&auto=format&fit=crop&w=500&q=80',
    category: 'Áo Nam',
    inStock: true,
    rating: 4.6,
    reviewsCount: 154,
    sizes: ['M', 'L', 'XL', 'XXL'],
    colors: [{ name: 'Trắng', hex: '#FFFFFF' }]
  },
  {
    id: 'p6',
    name: 'Set Đồ Thể Thao Nữ Áo Bra & Quần Legging Tập Gym',
    price: 400000,
    originalPrice: 500000,
    discountPercent: 20,
    imageUrl: 'https://images.unsplash.com/photo-1518310383802-640c2de311b2?ixlib=rb-4.0.3&auto=format&fit=crop&w=500&q=80',
    category: 'Đồ Tập Nữ',
    inStock: true,
    rating: 4.9,
    reviewsCount: 320,
    isNew: true,
    sizes: ['S', 'M', 'L'],
    colors: [{ name: 'Đen', hex: '#111827' }]
  },
  {
    id: 'p7',
    name: 'Giày Sneaker Nam Thể Thao Chạy Bộ Thoáng Khí',
    price: 650000,
    imageUrl: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?ixlib=rb-4.0.3&auto=format&fit=crop&w=500&q=80',
    category: 'Giày Nam',
    inStock: true,
    rating: 4.8,
    reviewsCount: 89,
    sizes: ['39', '40', '41', '42'],
    colors: [{ name: 'Đỏ', hex: '#DC2626' }]
  },
  {
    id: 'p8',
    name: 'Túi Xách Nữ Da Thật Đeo Chéo Sang Trọng',
    price: 890000,
    originalPrice: 1200000,
    discountPercent: 25,
    imageUrl: 'https://images.unsplash.com/photo-1584916201218-f4242ceb4809?ixlib=rb-4.0.3&auto=format&fit=crop&w=500&q=80',
    category: 'Phụ Kiện',
    inStock: true,
    rating: 4.9,
    reviewsCount: 45,
    sizes: ['Freesize'],
    colors: [{ name: 'Nâu', hex: '#78350F' }]
  },
  {
    id: 'p9',
    name: 'Áo Len Cổ Lọ Nữ Mùa Đông Dày Dặn Ấm Áp',
    price: 350000,
    imageUrl: 'https://images.unsplash.com/photo-1620799140408-edc6dcb6d633?ixlib=rb-4.0.3&auto=format&fit=crop&w=500&q=80',
    category: 'Áo Nữ',
    inStock: true,
    rating: 4.7,
    reviewsCount: 112,
    isNew: true,
    sizes: ['S', 'M', 'L'],
    colors: [{ name: 'Be', hex: '#F3F4F6' }]
  },
  {
    id: 'p10',
    name: 'Quần Khaki Nam Dáng Slimfit Trẻ Trung',
    price: 380000,
    imageUrl: 'https://images.unsplash.com/photo-1624378439575-d8705ad7ae80?ixlib=rb-4.0.3&auto=format&fit=crop&w=500&q=80',
    category: 'Quần Nam',
    inStock: true,
    rating: 4.6,
    reviewsCount: 78,
    sizes: ['29', '30', '31', '32'],
    colors: [{ name: 'Xanh Navy', hex: '#1E3A8A' }]
  },
  {
    id: 'p11',
    name: 'Mũ Lưỡi Trai Cotton Unisex Thêu Logo',
    price: 150000,
    originalPrice: 200000,
    discountPercent: 25,
    imageUrl: 'https://images.unsplash.com/photo-1588850561407-ed78c282e89b?ixlib=rb-4.0.3&auto=format&fit=crop&w=500&q=80',
    category: 'Phụ Kiện',
    inStock: true,
    rating: 4.5,
    reviewsCount: 33,
    sizes: ['Freesize'],
    colors: [{ name: 'Đen', hex: '#111827' }]
  },
  {
    id: 'p12',
    name: 'Kính Mát Nữ Phân Cực Thời Trang Đi Biển',
    price: 250000,
    imageUrl: 'https://images.unsplash.com/photo-1511499767150-a48a237f0083?ixlib=rb-4.0.3&auto=format&fit=crop&w=500&q=80',
    category: 'Phụ Kiện',
    inStock: true,
    rating: 4.8,
    reviewsCount: 201,
    sizes: ['Freesize'],
    colors: [{ name: 'Đen Tráng Gương', hex: '#111827' }]
  }
];
