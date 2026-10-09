import React from 'react';
import { useCart } from '../context/CartContext';
import { Trash2, ArrowRight, Minus, Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const MiniCart: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { items, removeFromCart, updateQuantity, toggleSelection, toggleAllSelection, cartCount, cartTotal } = useCart();
  const navigate = useNavigate();

  const allSelected = items.length > 0 && items.every(i => i.selected !== false);

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-6 text-slate-500">
        <img src="https://cdni.iconscout.com/illustration/premium/thumb/empty-cart-2130356-1800917.png" alt="Empty Cart" className="w-48 mb-4 opacity-50" />
        <p className="font-semibold text-slate-700">Giỏ hàng của bạn đang trống</p>
        <button 
          onClick={onClose}
          className="mt-6 px-6 py-2.5 bg-slate-900 text-white font-bold rounded-full hover:bg-primary transition-colors"
        >
          Tiếp tục mua sắm
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-[#FAFAFA] text-slate-900">
      {/* Header Giỏ Hàng có nút Chọn Tất Cả */}
      <div className="p-4 bg-white border-b border-slate-200 flex items-center justify-between shadow-sm z-10">
        <label className="flex items-center gap-2 cursor-pointer group">
          <input 
            type="checkbox" 
            checked={allSelected}
            onChange={(e) => toggleAllSelection(e.target.checked)}
            className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
          />
          <span className="text-sm font-bold text-slate-700 group-hover:text-blue-600 transition-colors">
            Chọn tất cả ({items.length})
          </span>
        </label>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
        {items.map((item) => (
          <div key={item.id} className="flex gap-4 p-4 bg-white rounded-2xl border border-slate-100 shadow-[0_4px_20px_rgb(0,0,0,0.03)] relative group">
            
            <div className="flex items-center">
               <input 
                  type="checkbox" 
                  checked={item.selected !== false}
                  onChange={() => toggleSelection(item.id)}
                  className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                />
            </div>

            <img src={item.product.imageUrl} alt={item.product.name} className="w-20 h-24 object-cover rounded-xl border border-slate-100 bg-slate-50" />
            
            <div className="flex-1 flex flex-col justify-between py-0.5">
              <div className="pr-6">
                <h4 className="font-bold text-sm text-slate-800 line-clamp-2 leading-snug">{item.product.name}</h4>
                <p className="text-xs text-slate-500 mt-1 font-medium bg-slate-50 inline-block px-2 py-0.5 rounded-md border border-slate-100">
                  {item.selectedColor && <span>{item.selectedColor}</span>}
                  {item.selectedColor && item.selectedSize && <span> • </span>}
                  {item.selectedSize && <span>{item.selectedSize}</span>}
                </p>
              </div>
              
              <div className="flex justify-between items-end mt-2">
                <span className="font-extrabold text-blue-600">{(item.product.price || 0).toLocaleString()}đ</span>
                
                {/* Nút tăng giảm số lượng */}
                <div className="flex items-center bg-slate-50 border border-slate-200 rounded-lg p-0.5">
                  <button 
                    onClick={() => updateQuantity(item.id, item.quantity - 1)}
                    className="w-7 h-7 flex items-center justify-center text-slate-600 hover:text-slate-900 hover:bg-slate-200 rounded-md transition-colors"
                  >
                    <Minus size={14} />
                  </button>
                  <span className="w-8 text-center text-sm font-bold text-slate-800">{item.quantity}</span>
                  <button 
                    onClick={() => updateQuantity(item.id, item.quantity + 1)}
                    className="w-7 h-7 flex items-center justify-center text-slate-600 hover:text-slate-900 hover:bg-slate-200 rounded-md transition-colors"
                  >
                    <Plus size={14} />
                  </button>
                </div>
              </div>
            </div>

            <button 
              onClick={() => removeFromCart(item.id)}
              className="absolute top-3 right-3 p-1.5 bg-white text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-full shadow-sm opacity-0 group-hover:opacity-100 transition-all border border-transparent hover:border-red-100"
              title="Xóa sản phẩm"
            >
              <Trash2 size={16} />
            </button>
          </div>
        ))}
      </div>
      
      <div className="p-6 bg-white border-t border-slate-200 shadow-[0_-10px_30px_rgb(0,0,0,0.03)] z-10">
        <div className="flex justify-between items-end mb-4">
          <span className="font-bold text-slate-600 text-sm">Tạm tính ({cartCount} món):</span>
          <span className="text-2xl font-black text-blue-600">{(cartTotal || 0).toLocaleString()}đ</span>
        </div>
        <button 
          onClick={() => {
            if (cartCount > 0) {
              onClose();
              navigate('/checkout');
            }
          }}
          disabled={cartCount === 0}
          className="w-full py-3.5 bg-slate-900 text-white font-bold rounded-xl hover:bg-blue-600 disabled:bg-slate-300 disabled:cursor-not-allowed transition-all shadow-md flex justify-center items-center gap-2"
        >
          {cartCount > 0 ? 'Thanh toán ngay' : 'Vui lòng chọn sản phẩm'} <ArrowRight size={18} />
        </button>
      </div>
    </div>
  );
};
