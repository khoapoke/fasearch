export interface Product {
  id: string;
  name: string;
  price: number;
  originalPrice?: number;
  discountPercent?: number;
  imageUrl: string;
  images?: string[];
  category: string;
  inStock: boolean;
  rating: number;
  reviewsCount: number;
  isNew?: boolean;
  description?: string;
  sizes?: string[];
  colors?: { name: string; hex: string }[];
}
