import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCart } from '@/features/cart/context/CartContext';
import { ShieldCheck, CheckCircle2, Ticket, MapPin, ChevronDown } from 'lucide-react';

// Mock Addresses matching Profile Page
const savedAddresses = [
  { id: 1, name: 'Nguyễn Văn Hưng', phone: '0918.443.882', address: '128 Hai Bà Trưng, Phường Bến Nghé, Quận 1, TP. Hồ Chí Minh', isDefault: true },
  { id: 2, name: 'Nguyễn Văn Hưng', phone: '0918.443.882', address: 'Tòa nhà Bitexco, Số 2 Hải Triều, Quận 1, TP. Hồ Chí Minh', isDefault: false },
];

export const CheckoutPage: React.FC = () => {
  const { cartTotal, items, cartCount } = useCart();
  const navigate = useNavigate();
  const [success, setSuccess] = useState(false);
  
  // Voucher state
  const [voucherCode, setVoucherCode] = useState('');
  const [appliedVoucher, setAppliedVoucher] = useState<{ code: string, discount: number } | null>(null);
  const [voucherError, setVoucherError] = useState('');

  // Shipping Form State
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [showAddressDropdown, setShowAddressDropdown] = useState(false);

  const formatVND = (amount: number) => amount.toLocaleString() + 'đ';

  const handleApplyVoucher = () => {
    setVoucherError('');
    if (!voucherCode) return;
    
    const code = voucherCode.toUpperCase();
    if (code === 'GIAM10K') {
      setAppliedVoucher({ code, discount: 10000 });
    } else if (code === 'COOLMATE') {
      setAppliedVoucher({ code, discount: cartTotal * 0.1 }); // 10%
    } else if (code === 'FREESHIP') {
      setAppliedVoucher({ code, discount: 30000 });
    } else {
      setVoucherError('Mã giảm giá không hợp lệ hoặc đã hết hạn.');
      setAppliedVoucher(null);
    }
  };

  const handleSelectAddress = (addr: any) => {
    setName(addr.name);
    setPhone(addr.phone);
    setAddress(addr.address);
    setShowAddressDropdown(false);
  };

  const finalTotal = Math.max(0, cartTotal - (appliedVoucher?.discount || 0));

  const handleCheckout = (e: React.FormEvent) => {
    e.preventDefault();
    setSuccess(true);
  };

  const selectedItems = items.filter(i => i.selected !== false);

  if (selectedItems.length === 0 && !success) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <h2 className="text-2xl font-bold text-slate-900 mb-4">Bạn chưa chọn sản phẩm nào để thanh toán</h2>
        <button onClick={() => navigate('/cart')} className="px-6 py-2 bg-slate-900 text-white font-bold rounded-full hover:bg-blue-600 transition-colors">
          Quay lại Giỏ hàng
        </button>
      </div>
    );
  }

  if (success) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-24 text-center animate-in fade-in zoom-in duration-500">
        <CheckCircle2 size={80} className="text-emerald-500 mx-auto mb-6" />
        <h2 className="text-3xl font-black text-slate-900 mb-4">ĐẶT HÀNG THÀNH CÔNG!</h2>
        <p className="text-slate-600 mb-8 font-medium">Cảm ơn bạn đã mua sắm tại FashionSearch. Đơn hàng của bạn đang được xử lý.</p>
        <button onClick={() => navigate('/profile')} className="px-8 py-3 bg-gradient-to-r from-blue-600 to-blue-500 text-white font-bold rounded-xl hover:shadow-lg transition-all">
          Xem đơn hàng
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-6 py-12 animate-in fade-in bg-[#FAFAFA] min-h-screen">
      <h1 className="text-3xl font-black text-slate-900 mb-8 uppercase tracking-tight">Thanh Toán</h1>
      
      <form onSubmit={handleCheckout} className="flex flex-col lg:flex-row gap-8 lg:gap-12">
        {/* Cột trái: Thông tin giao hàng */}
        <div className="flex-1 space-y-8">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 md:p-8">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-black text-slate-900 uppercase tracking-wide">Thông tin giao hàng</h2>
              
              {/* Nút chọn địa chỉ lưu sẵn */}
              <div className="relative">
                <button 
                  type="button" 
                  onClick={() => setShowAddressDropdown(!showAddressDropdown)}
                  className="flex items-center gap-2 text-sm font-bold text-blue-600 hover:text-blue-800 bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-100 transition-colors"
                >
                  <MapPin size={16} /> Chọn địa chỉ đã lưu <ChevronDown size={14} />
                </button>

                {showAddressDropdown && (
                  <div className="absolute right-0 top-10 w-[320px] bg-white border border-slate-200 shadow-xl rounded-xl p-2 z-50">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-2 px-2">Địa chỉ của bạn</p>
                    {savedAddresses.map(addr => (
                      <div 
                        key={addr.id} 
                        onClick={() => handleSelectAddress(addr)}
                        className="p-3 hover:bg-slate-50 rounded-lg cursor-pointer border border-transparent hover:border-slate-200 transition-colors mb-1 last:mb-0"
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-bold text-slate-800 text-sm">{addr.name}</span>
                          <span className="text-xs text-slate-500 font-medium">{addr.phone}</span>
                          {addr.isDefault && <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-bold ml-auto">Mặc định</span>}
                        </div>
                        <p className="text-xs text-slate-600 line-clamp-2">{addr.address}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Họ và tên</label>
                <input 
                  required 
                  type="text" 
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-shadow text-slate-900 font-medium bg-slate-50 focus:bg-white" 
                  placeholder="VD: Nguyễn Văn A" 
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Số điện thoại</label>
                <input 
                  required 
                  type="tel" 
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-shadow text-slate-900 font-medium bg-slate-50 focus:bg-white" 
                  placeholder="VD: 0912345678" 
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">Địa chỉ nhận hàng</label>
              <textarea 
                required 
                value={address}
                onChange={e => setAddress(e.target.value)}
                className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none h-28 resize-none transition-shadow text-slate-900 font-medium bg-slate-50 focus:bg-white" 
                placeholder="Số nhà, đường, phường/xã, quận/huyện..."
              ></textarea>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 md:p-8">
            <h2 className="text-xl font-black text-slate-900 mb-6 uppercase tracking-wide">Phương thức thanh toán</h2>
            <div className="space-y-4">
              <label className="flex items-center gap-4 p-4 border-2 border-blue-500 rounded-xl bg-blue-50 cursor-pointer transition-colors">
                <input type="radio" name="payment" defaultChecked className="text-blue-600 focus:ring-blue-500 w-5 h-5 cursor-pointer" />
                <span className="font-bold text-slate-900">Thanh toán khi nhận hàng (COD)</span>
              </label>
              <label className="flex items-center gap-4 p-4 border border-slate-200 rounded-xl cursor-not-allowed opacity-50 bg-slate-50">
                <input type="radio" name="payment" disabled className="w-5 h-5" />
                <span className="font-bold text-slate-900">Thẻ tín dụng / VNPay (Đang bảo trì)</span>
              </label>
            </div>
          </div>
        </div>

        {/* Cột phải: Tóm tắt đơn hàng & Voucher */}
        <div className="w-full lg:w-[420px] shrink-0">
          <div className="bg-white rounded-2xl border border-slate-200 p-6 md:p-8 sticky top-24 shadow-sm">
            <h2 className="text-xl font-black text-slate-900 mb-6 uppercase tracking-wide">Đơn hàng ({selectedItems.reduce((acc, item) => acc + item.quantity, 0)} SP)</h2>
            
            <div className="space-y-4 mb-6 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
              {selectedItems.map(item => (
                <div key={item.id} className="flex gap-4 bg-slate-50 p-3 rounded-xl border border-slate-100">
                  <img src={item.product.imageUrl} alt={item.product.name} className="w-16 h-20 object-cover rounded-lg border border-slate-200" />
                  <div className="flex-1 flex flex-col justify-between">
                    <div>
                      <p className="text-sm font-bold text-slate-900 line-clamp-2">{item.product.name}</p>
                      <p className="text-xs text-slate-500 font-medium mt-1">
                        {item.selectedSize && <span>Size: {item.selectedSize} </span>}
                        {item.selectedColor && <span>| Màu: {item.selectedColor}</span>}
                      </p>
                    </div>
                    <div className="flex justify-between items-center mt-2">
                      <span className="text-xs font-bold text-slate-600 bg-white px-2 py-0.5 rounded-md border border-slate-200">x{item.quantity}</span>
                      <span className="text-sm font-black text-blue-600">{formatVND(item.product.price * item.quantity)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Khung nhập Voucher */}
            <div className="mb-6 pt-6 border-t border-slate-200">
              <label className="flex items-center gap-2 text-sm font-bold text-slate-900 mb-3 uppercase tracking-wide">
                <Ticket size={16} className="text-blue-600" /> Mã giảm giá / Voucher
              </label>
              <div className="flex gap-2">
                <input 
                  type="text" 
                  value={voucherCode}
                  onChange={(e) => setVoucherCode(e.target.value)}
                  placeholder="Nhập mã (VD: COOLMATE)"
                  className="flex-1 px-4 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none uppercase text-sm font-bold text-slate-900"
                />
                <button 
                  type="button"
                  onClick={handleApplyVoucher}
                  className="px-4 py-2.5 bg-slate-900 text-white font-bold rounded-xl hover:bg-blue-600 transition-colors text-sm whitespace-nowrap"
                >
                  Áp dụng
                </button>
              </div>
              {voucherError && <p className="text-red-500 text-xs font-bold mt-2 animate-in fade-in">{voucherError}</p>}
              {appliedVoucher && (
                <div className="mt-3 p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex justify-between items-center animate-in fade-in">
                  <div>
                    <p className="text-xs font-bold text-emerald-700">Đã áp dụng mã:</p>
                    <p className="text-sm font-black text-emerald-800">{appliedVoucher.code}</p>
                  </div>
                  <button type="button" onClick={() => setAppliedVoucher(null)} className="text-xs font-bold text-red-500 hover:underline">Hủy</button>
                </div>
              )}
            </div>

            <div className="space-y-3 text-sm font-bold text-slate-600 mb-6 border-t border-slate-200 pt-6">
              <div className="flex justify-between">
                <span>Tổng tiền hàng</span>
                <span className="text-slate-900">{formatVND(cartTotal)}</span>
              </div>
              <div className="flex justify-between">
                <span>Phí vận chuyển</span>
                <span className="text-slate-900">30.000đ</span>
              </div>
              {appliedVoucher && (
                <div className="flex justify-between text-emerald-600">
                  <span>Giảm giá ({appliedVoucher.code})</span>
                  <span>-{formatVND(appliedVoucher.discount)}</span>
                </div>
              )}
            </div>

            <div className="pt-4 border-t border-slate-200 mb-6 bg-slate-50 p-4 rounded-xl shadow-inner">
              <div className="flex justify-between items-center mb-1">
                <span className="font-black text-slate-900 uppercase">Tổng thanh toán</span>
                <span className="font-black text-blue-600 text-2xl">{formatVND(finalTotal + 30000)}</span>
              </div>
              <p className="text-xs text-slate-400 text-right">(Đã bao gồm VAT & phí ship)</p>
            </div>

            <button type="submit" className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-blue-600 to-blue-500 text-white py-4 rounded-xl font-black text-lg hover:shadow-lg hover:scale-[1.02] transition-all uppercase tracking-wide">
              ĐẶT HÀNG NGAY
            </button>

            <div className="mt-6 flex items-center justify-center gap-2 text-xs font-medium text-slate-500 bg-white py-2 rounded-lg border border-slate-100">
              <ShieldCheck size={16} className="text-emerald-500" /> Thanh toán an toàn, bảo mật 100%
            </div>
          </div>
        </div>
      </form>
    </div>
  );
};
