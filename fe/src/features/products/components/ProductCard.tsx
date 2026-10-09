import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Product } from '../types';
import { useCart } from '@/features/cart/context/CartContext';

interface ProductCardProps {
  product: Product;
}

export const ProductCard: React.FC<ProductCardProps> = ({ product }) => {
  const navigate = useNavigate();
  const { addToCart } = useCart();
  const [selectedColor, setSelectedColor] = useState(0); // index
  
  // Dummy colors for demonstration based on the screenshot
  const colors = [
    { hex: '#1C2529', name: 'Đen nhạt' },
    { hex: '#111111', name: 'Đen tuyền' },
    { hex: '#4A5568', name: 'Xám đậm' }
  ];

  const handleNavigate = () => {
    navigate(`/product/${product.id}`);
  };

  const handleQuickAdd = (e: React.MouseEvent, size: string) => {
    e.stopPropagation();
    addToCart(product, 1, size, colors[selectedColor].name);
    // Có thể thêm toast thông báo ở đây
  };

  return (
    <div className="group flex flex-col gap-3 cursor-pointer" onClick={handleNavigate}>
      
      {/* 1. Hình ảnh & Quick Add Overlay */}
      <div className="relative aspect-[3/4] bg-[#EBEBEB] rounded-lg overflow-hidden">
        
        {/* Hình sản phẩm (Xoá BG gốc nếu có thể, hoặc dùng object-cover) */}
        <img
          src={product.imageUrl}
          alt={product.name}
          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105 mix-blend-multiply" 
          // mix-blend-multiply helps images with white BG blend into the gray container
        />

        {/* Badges - Đặt góc trên TRẢI hoặc PHẢI tuỳ ý, trong hình là NEW bên PHẢI */}
        <div className="absolute top-3 right-3 z-10">
          {product.isNew ? (
            <span className="bg-blue-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider shadow-sm">
              New
            </span>
          ) : product.discountPercent ? (
            <span className="bg-red-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider shadow-sm">
              Bán chạy
            </span>
          ) : null}
        </div>

        {/* Quick Add Overlay (Hiện lên khi hover) */}
        <div className="absolute inset-x-2 bottom-2 translate-y-4 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-300 z-20">
          <div className="bg-white/90 backdrop-blur-md rounded-xl p-3 shadow-lg flex flex-col items-center">
            <span className="text-xs font-bold text-slate-800 mb-2 flex items-center gap-1">
              Thêm nhanh vào giỏ hàng <span className="text-lg leading-none mb-0.5">+</span>
            </span>
            <div className="flex flex-wrap justify-center gap-1.5 w-full">
              {['S', 'M', 'L', 'XL', '2XL', '3XL'].map((size) => (
                <button
                  key={size}
                  onClick={(e) => handleQuickAdd(e, size)}
                  className="w-8 h-8 md:w-9 md:h-9 bg-white text-slate-700 text-xs font-bold rounded-lg border border-slate-200 hover:border-slate-900 hover:bg-slate-900 hover:text-white transition-colors flex items-center justify-center flex-shrink-0 shadow-sm"
                >
                  {size}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 2. Thông tin sản phẩm */}
      <div className="flex flex-col gap-2">
        {/* Color Swatches */}
        <div className="flex items-center gap-1.5">
          {colors.map((c, idx) => (
            <button
              key={idx}
              onClick={(e) => { e.stopPropagation(); setSelectedColor(idx); }}
              className={`w-6 h-6 rounded-full border-2 transition-all ${selectedColor === idx ? 'border-blue-600 scale-110' : 'border-transparent hover:border-slate-300'}`}
              title={c.name}
            >
              <span 
                className="block w-full h-full rounded-full border border-slate-200 shadow-sm" 
                style={{ backgroundColor: c.hex }} 
              />
            </button>
          ))}
        </div>

        {/* Tên sản phẩm */}
        <h3 className="font-semibold text-slate-800 text-sm leading-tight line-clamp-2">
          {product.name}
        </h3>

        {/* Giá */}
        <div className="flex items-center gap-2">
          <span className="font-bold text-slate-900">
            {product.price.toLocaleString()}đ
          </span>
          {product.originalPrice && (
            <span className="text-xs font-medium text-slate-400 line-through">
              {product.originalPrice.toLocaleString()}đ
            </span>
          )}
        </div>
      </div>
      
    </div>
  );
};
