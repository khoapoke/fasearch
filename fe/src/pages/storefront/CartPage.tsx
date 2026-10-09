import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useCart } from '@/features/cart/context/CartContext';
import { formatVND } from '@/utils/format';
import { Trash2, ArrowRight } from 'lucide-react';

export const CartPage: React.FC = () => {
  const { items, removeFromCart, updateQuantity, cartTotal, cartCount } = useCart();
  const navigate = useNavigate();

  if (items.length === 0) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center">
        <h2 className="text-2xl font-bold text-charcoal-900 mb-4">Giỏ hàng của bạn đang trống</h2>
        <p className="text-charcoal-500 mb-8">Hãy khám phá các sản phẩm tuyệt vời của chúng tôi nhé!</p>
        <button onClick={() => navigate('/')} className="px-6 py-3 bg-primary text-white font-bold rounded-base hover:bg-primary-hover transition-colors">
          Tiếp tục mua sắm
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-charcoal-900 mb-8">Giỏ hàng của bạn ({cartCount} sản phẩm)</h1>
      
      <div className="flex flex-col lg:flex-row gap-8">
        {/* Left: Cart Items */}
        <div className="flex-1">
          <div className="bg-white rounded-xl border border-charcoal-200 shadow-sm overflow-hidden divide-y divide-charcoal-200">
            {items.map((item) => (
              <div key={item.id} className="p-4 sm:p-6 flex flex-col sm:flex-row items-start gap-4 sm:gap-6">
                <img 
                  src={item.product.imageUrl} 
                  alt={item.product.name} 
                  className="w-24 h-32 object-cover rounded-lg bg-charcoal-100"
                />
                
                <div className="flex-1">
                  <div className="flex justify-between items-start mb-1">
                    <h3 className="font-bold text-charcoal-900 hover:text-primary cursor-pointer line-clamp-2 pr-4" onClick={() => navigate(`/product/${item.product.id}`)}>
                      {item.product.name}
                    </h3>
                    <button onClick={() => removeFromCart(item.id)} className="text-charcoal-400 hover:text-crimson transition-colors">
                      <Trash2 size={18} />
                    </button>
                  </div>
                  
                  <div className="text-sm text-charcoal-500 mb-4 flex gap-3">
                    {item.selectedColor && <span>Màu: <strong className="text-charcoal-700">{item.selectedColor}</strong></span>}
                    {item.selectedSize && <span>Size: <strong className="text-charcoal-700">{item.selectedSize}</strong></span>}
                  </div>

                  <div className="flex items-center justify-between mt-auto">
                    <div className="flex items-center border border-charcoal-200 rounded-base overflow-hidden h-9">
                      <button onClick={() => updateQuantity(item.id, item.quantity - 1)} className="px-3 text-charcoal-600 hover:bg-charcoal-100 h-full font-bold transition-colors">-</button>
                      <div className="w-10 text-center font-semibold text-charcoal-900 text-sm">{item.quantity}</div>
                      <button onClick={() => updateQuantity(item.id, item.quantity + 1)} className="px-3 text-charcoal-600 hover:bg-charcoal-100 h-full font-bold transition-colors">+</button>
                    </div>

                    <div className="text-right">
                      <p className="font-bold text-primary text-lg">{formatVND(item.product.price * item.quantity)}</p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right: Order Summary */}
        <div className="w-full lg:w-96">
          <div className="bg-white rounded-xl border border-charcoal-200 shadow-sm p-6 sticky top-24">
            <h2 className="text-lg font-bold text-charcoal-900 mb-4">Tóm tắt đơn hàng</h2>
            
            <div className="space-y-3 text-sm text-charcoal-600 mb-4">
              <div className="flex justify-between">
                <span>Tổng tiền hàng</span>
                <span className="font-semibold text-charcoal-900">{formatVND(cartTotal)}</span>
              </div>
              <div className="flex justify-between">
                <span>Phí vận chuyển</span>
                <span className="font-semibold text-charcoal-900">Chưa tính</span>
              </div>
            </div>

            <div className="pt-4 border-t border-charcoal-200 mb-6">
              <div className="flex justify-between items-center mb-1">
                <span className="font-bold text-charcoal-900">Tổng thanh toán</span>
                <span className="font-extrabold text-primary text-xl">{formatVND(cartTotal)}</span>
              </div>
              <p className="text-xs text-charcoal-400 text-right">(Đã bao gồm VAT nếu có)</p>
            </div>

            <button onClick={() => navigate('/checkout')} className="w-full flex items-center justify-center gap-2 bg-primary text-white py-3 rounded-base font-bold hover:bg-primary-hover transition-colors">
              TIẾN HÀNH THANH TOÁN <ArrowRight size={18} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
