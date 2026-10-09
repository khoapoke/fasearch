import { Product } from '../types';
import { mockProducts } from '../mocks/products.mock';

export const fetchProducts = async (): Promise<Product[]> => {
  // TODO: Replace with real API endpoint
  // return fetch('/api/v1/products').then(res => res.json());
  
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(mockProducts);
    }, 600); // Fake delay for skeleton loading
  });
};
