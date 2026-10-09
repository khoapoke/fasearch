import React, { createContext, useContext, useState, useEffect } from 'react';
import { Product } from '@/features/products/types';

export interface CartItem {
  id: string;
  product: Product;
  quantity: number;
  selectedSize?: string;
  selectedColor?: string;
  selected?: boolean;
}

interface CartContextType {
  items: CartItem[];
  addToCart: (product: Product, quantity: number, size?: string, color?: string) => void;
  removeFromCart: (id: string) => void;
  updateQuantity: (id: string, quantity: number) => void;
  toggleSelection: (id: string) => void;
  toggleAllSelection: (selected: boolean) => void;
  cartTotal: number;
  cartCount: number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [items, setItems] = useState<CartItem[]>([]);

  // Load from local storage
  useEffect(() => {
    const savedCart = localStorage.getItem('fasearch_cart');
    if (savedCart) {
      try {
        setItems(JSON.parse(savedCart));
      } catch (e) {
        console.error('Failed to parse cart');
      }
    }
  }, []);

  // Save to local storage
  useEffect(() => {
    localStorage.setItem('fasearch_cart', JSON.stringify(items));
  }, [items]);

  const addToCart = (product: Product, quantity: number, size?: string, color?: string) => {
    setItems(prev => {
      const existingIdx = prev.findIndex(
        i => i.product.id === product.id && i.selectedSize === size && i.selectedColor === color
      );
      
      if (existingIdx > -1) {
        const newItems = [...prev];
        newItems[existingIdx].quantity += quantity;
        return newItems;
      }
      
      return [...prev, {
        id: `${product.id}-${size}-${color}-${Date.now()}`,
        product,
        quantity,
        selectedSize: size,
        selectedColor: color,
        selected: true
      }];
    });
  };

  const removeFromCart = (id: string) => {
    setItems(prev => prev.filter(i => i.id !== id));
  };

  const updateQuantity = (id: string, quantity: number) => {
    if (quantity < 1) return;
    setItems(prev => prev.map(i => i.id === id ? { ...i, quantity } : i));
  };

  const toggleSelection = (id: string) => {
    setItems(prev => prev.map(i => i.id === id ? { ...i, selected: !i.selected } : i));
  };

  const toggleAllSelection = (selected: boolean) => {
    setItems(prev => prev.map(i => ({ ...i, selected })));
  };

  const cartTotal = items.filter(i => i.selected !== false).reduce((total, item) => total + (item.product.price * item.quantity), 0);
  const cartCount = items.filter(i => i.selected !== false).reduce((count, item) => count + item.quantity, 0);

  return (
    <CartContext.Provider value={{ items, addToCart, removeFromCart, updateQuantity, toggleSelection, toggleAllSelection, cartTotal, cartCount }}>
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => {
  const context = useContext(CartContext);
  if (context === undefined) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
};
