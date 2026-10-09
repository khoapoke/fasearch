import React, { useState } from 'react';
import { User, Package, Clock, MapPin, CheckCircle2, ChevronRight, FileText, Camera, Plus, Edit2, ArrowLeft, X, LogOut } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/features/auth/context/AuthContext';

export const ProfilePage: React.FC = () => {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'profile' | 'orders' | 'history' | 'address'>('orders');
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);

  // Address Modal States
  const [isAddingAddress, setIsAddingAddress] = useState(false);
  const [newAddrName, setNewAddrName] = useState('');
  const [newAddrPhone, setNewAddrPhone] = useState('');
  const [newAddrDetail, setNewAddrDetail] = useState('');
  const [newAddrIsDefault, setNewAddrIsDefault] = useState(false);

  // Mock Orders List
  const orders = [
    { id: 'PK-89201-1', date: '09:42 12/10/2026', total: 849000, status: 'Đang đóng gói', statusColor: 'text-orange-600 bg-orange-50 border-orange-200' },
    { id: 'PK-77211-3', date: '14:20 01/09/2026', total: 1250000, status: 'Hoàn thành', statusColor: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
    { id: 'PK-66100-2', date: '10:05 15/08/2026', total: 420000, status: 'Đã hủy', statusColor: 'text-red-600 bg-red-50 border-red-200' },
  ];

  // Mock Addresses (Now in state to allow adding)
  const [addresses, setAddresses] = useState([
    { id: 1, name: 'Nguyễn Văn Hưng', phone: '0918.443.882', address: '128 Hai Bà Trưng, Phường Bến Nghé, Quận 1, TP. Hồ Chí Minh', isDefault: true },
    { id: 2, name: 'Nguyễn Văn Hưng', phone: '0918.443.882', address: 'Tòa nhà Bitexco, Số 2 Hải Triều, Quận 1, TP. Hồ Chí Minh', isDefault: false },
  ]);

  const handleSaveAddress = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAddrName || !newAddrPhone || !newAddrDetail) return;
    
    let updatedAddresses = [...addresses];
    if (newAddrIsDefault) {
      updatedAddresses = updatedAddresses.map(a => ({ ...a, isDefault: false }));
    }
    
    const newAddress = {
      id: Date.now(),
      name: newAddrName,
      phone: newAddrPhone,
      address: newAddrDetail,
      isDefault: newAddrIsDefault || addresses.length === 0
    };
    
    setAddresses([...updatedAddresses, newAddress]);
    setIsAddingAddress(false);
    
    // Reset form
    setNewAddrName('');
    setNewAddrPhone('');
    setNewAddrDetail('');
    setNewAddrIsDefault(false);
  };

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-[#F4F6F8] py-8">
      <div className="max-w-7xl mx-auto px-4 md:px-6 relative">
        
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-slate-500 font-medium mb-6">
          <Link to="/" className="hover:text-blue-600">Trang chủ</Link>
          <ChevronRight size={14} />
          <span className="text-slate-800">Tài khoản của tôi</span>
        </div>

        <div className="flex flex-col lg:flex-row gap-8">
          
          {/* SIDEBAR */}
          <aside className="w-full lg:w-72 shrink-0">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="p-6 border-b border-slate-100 flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 border border-slate-200 shrink-0 relative">
                  <User size={24} />
                  <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-white rounded-full flex items-center justify-center shadow">
                    <div className="w-4 h-4 bg-blue-600 rounded-full flex items-center justify-center text-white"><Camera size={10} /></div>
                  </div>
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">Tài khoản</p>
                  <h3 className="font-bold text-slate-800 line-clamp-1">Nguyễn Văn Hưng</h3>
                </div>
              </div>
              <nav className="p-2 space-y-1">
                <button 
                  onClick={() => { setActiveTab('profile'); setSelectedOrderId(null); }}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-semibold transition-colors ${activeTab === 'profile' ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50'}`}
                >
                  <User size={18} /> Quản lý tài khoản
                </button>
                <button 
                  onClick={() => { setActiveTab('orders'); setSelectedOrderId(null); }}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-semibold transition-colors ${activeTab === 'orders' ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50'}`}
                >
                  <Package size={18} /> Quản lý đơn hàng
                </button>
                <button 
                  onClick={() => { setActiveTab('history'); setSelectedOrderId(null); }}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-semibold transition-colors ${activeTab === 'history' ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50'}`}
                >
                  <Clock size={18} /> Lịch sử mua hàng
                </button>
                <button 
                  onClick={() => { setActiveTab('address'); setSelectedOrderId(null); }}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-semibold transition-colors mb-2 ${activeTab === 'address' ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50'}`}
                >
                  <MapPin size={18} /> Địa chỉ giao hàng
                </button>
                
                {/* LOGOUT BUTTON */}
                <div className="border-t border-slate-100 pt-2 mt-2">
                  <button 
                    onClick={handleLogout}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-xl font-semibold text-red-600 hover:bg-red-50 transition-colors"
                  >
                    <LogOut size={18} /> Đăng xuất
                  </button>
                </div>
              </nav>
            </div>
          </aside>

          {/* MAIN CONTENT */}
          <main className="flex-1">
            {/* THÔNG TIN TÀI KHOẢN */}
            {activeTab === 'profile' && (
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 animate-in fade-in">
                <h2 className="text-xl font-black text-slate-800 mb-6 uppercase tracking-wide">Thông tin tài khoản</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl">
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">Họ và tên</label>
                    <input type="text" defaultValue="Nguyễn Văn Hưng" className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-medium" />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">Số điện thoại</label>
                    <input type="text" defaultValue="0918.443.882" className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-medium" />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">Email</label>
                    <input type="email" defaultValue="hung.nguyen@email.com" className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-medium" />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">Ngày sinh</label>
                    <input type="date" defaultValue="1995-10-15" className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-medium text-slate-700" />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-bold text-slate-700 mb-2">Giới tính</label>
                    <div className="flex gap-6">
                      <label className="flex items-center gap-2 cursor-pointer font-medium text-slate-700">
                        <input type="radio" name="gender" defaultChecked className="w-4 h-4 text-blue-600 focus:ring-blue-500" /> Nam
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer font-medium text-slate-700">
                        <input type="radio" name="gender" className="w-4 h-4 text-blue-600 focus:ring-blue-500" /> Nữ
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer font-medium text-slate-700">
                        <input type="radio" name="gender" className="w-4 h-4 text-blue-600 focus:ring-blue-500" /> Khác
                      </label>
                    </div>
                  </div>
                  <div className="md:col-span-2 mt-4 pt-6 border-t border-slate-100 flex gap-4">
                    <button className="px-6 py-2.5 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 transition-colors shadow-sm">Lưu thay đổi</button>
                    <button className="px-6 py-2.5 bg-slate-100 text-slate-700 font-bold rounded-lg hover:bg-slate-200 transition-colors">Đổi mật khẩu</button>
                  </div>
                </div>
              </div>
            )}

            {/* QUẢN LÝ ĐƠN HÀNG */}
            {activeTab === 'orders' && (
              <div className="animate-in fade-in">
                {!selectedOrderId ? (
                  <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
                    <h2 className="text-xl font-black text-slate-800 mb-6 uppercase tracking-wide">Quản lý đơn hàng</h2>
                    <div className="space-y-4">
                      {orders.map(order => (
                        <div 
                          key={order.id} 
                          onClick={() => setSelectedOrderId(order.id)}
                          className="p-4 border border-slate-200 rounded-xl hover:border-blue-400 hover:shadow-md transition-all cursor-pointer bg-white group flex flex-col md:flex-row justify-between items-start md:items-center gap-4"
                        >
                          <div>
                            <div className="flex items-center gap-3 mb-1">
                              <span className="font-bold text-slate-900 group-hover:text-blue-600 transition-colors">{order.id}</span>
                              <span className={`text-xs font-bold px-2 py-0.5 rounded-md border ${order.statusColor}`}>{order.status}</span>
                            </div>
                            <p className="text-sm font-medium text-slate-500">Ngày đặt: {order.date}</p>
                          </div>
                          <div className="flex items-center gap-6 w-full md:w-auto justify-between md:justify-end">
                            <div className="text-right">
                              <p className="text-xs font-bold text-slate-400 uppercase tracking-wide">Tổng tiền</p>
                              <p className="font-black text-slate-900 text-lg">{order.total.toLocaleString()} đ</p>
                            </div>
                            <ChevronRight className="text-slate-300 group-hover:text-blue-500 transition-colors" />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-6">
                    <button onClick={() => setSelectedOrderId(null)} className="flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-blue-600 transition-colors mb-2">
                      <ArrowLeft size={16} /> Quay lại danh sách
                    </button>
                    {/* ORDER STATUS PROGRESS */}
                    <div className="bg-gradient-to-b from-white to-slate-50 rounded-2xl shadow-sm border border-slate-200 p-6 relative overflow-hidden">
                      <div className="flex justify-between items-center mb-8">
                        <h2 className="text-lg font-black text-slate-800">Tiến trình xử lý đơn hàng <span className="text-slate-400 font-medium ml-2">#{selectedOrderId}</span></h2>
                        <span className="text-sm font-bold text-orange-600 bg-orange-50 px-3 py-1 rounded-full border border-orange-100 flex items-center gap-1">
                          Chuyển sang: Đang giao hàng <ArrowRightIcon />
                        </span>
                      </div>
                      <div className="flex justify-between items-start relative px-4">
                        <div className="absolute top-5 left-10 right-10 h-[3px] bg-slate-200 -z-0"></div>
                        <div className="absolute top-5 left-10 w-1/2 h-[3px] bg-green-500 -z-0"></div>
                        <div className="flex flex-col items-center gap-2 z-10 w-24">
                          <div className="w-10 h-10 rounded-full bg-green-500 text-white flex items-center justify-center shadow-md shadow-green-200"><CheckCircle2 size={24} /></div>
                          <div className="text-center"><p className="font-bold text-slate-800 text-sm">Mới tạo</p><p className="text-[10px] text-slate-500 font-medium">09:42 SA</p></div>
                        </div>
                        <div className="flex flex-col items-center gap-2 z-10 w-24">
                          <div className="w-10 h-10 rounded-full bg-green-500 text-white flex items-center justify-center shadow-md shadow-green-200"><CheckCircle2 size={24} /></div>
                          <div className="text-center"><p className="font-bold text-slate-800 text-sm">Đã xác nhận</p><p className="text-[10px] text-slate-500 font-medium">09:50 SA</p></div>
                        </div>
                        <div className="flex flex-col items-center gap-2 z-10 w-24">
                          <div className="w-10 h-10 rounded-full bg-orange-500 text-white flex items-center justify-center shadow-md shadow-orange-200 font-black text-lg">3</div>
                          <div className="text-center"><p className="font-bold text-orange-600 text-sm">Đang đóng gói</p><p className="text-[10px] text-orange-500 font-medium">Đang xử lý</p></div>
                        </div>
                        <div className="flex flex-col items-center gap-2 z-10 w-24 opacity-50">
                          <div className="w-10 h-10 rounded-full bg-slate-200 text-slate-500 flex items-center justify-center font-black text-lg">4</div>
                          <div className="text-center"><p className="font-bold text-slate-500 text-sm">Đang giao</p><p className="text-[10px] text-slate-400 font-medium">Chờ lấy hàng</p></div>
                        </div>
                        <div className="flex flex-col items-center gap-2 z-10 w-24 opacity-50">
                          <div className="w-10 h-10 rounded-full bg-slate-200 text-slate-500 flex items-center justify-center font-black text-lg">5</div>
                          <div className="text-center"><p className="font-bold text-slate-500 text-sm">Hoàn thành</p><p className="text-[10px] text-slate-400 font-medium">Dự kiến 16/10</p></div>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 flex flex-col justify-between">
                        <div>
                          <div className="flex items-center justify-between mb-4 pb-4 border-b border-slate-100">
                            <h3 className="font-bold text-slate-700 flex items-center gap-2"><User size={18} className="text-orange-500"/> Khách hàng</h3>
                            <span className="text-xs font-bold bg-amber-100 text-amber-700 px-2.5 py-1 rounded-md border border-amber-200">VIP Gold</span>
                          </div>
                          <h4 className="font-black text-slate-900 text-lg mb-1">Nguyễn Văn Hưng</h4>
                          <p className="text-sm font-medium text-slate-500">0918.443.882</p>
                          <p className="text-sm font-medium text-slate-500">hung.nguyen@email.com</p>
                        </div>
                      </div>
                      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 flex flex-col justify-between">
                        <div>
                          <div className="flex items-center justify-between mb-4 pb-4 border-b border-slate-100">
                            <h3 className="font-bold text-slate-700 flex items-center gap-2"><MapPin size={18} className="text-orange-500"/> Địa chỉ giao nhận</h3>
                            <span className="text-xs font-medium text-slate-500">Giao Hàng Nhanh</span>
                          </div>
                          <p className="font-medium text-slate-800 leading-relaxed">128 Hai Bà Trưng, Phường Bến Nghé, Quận 1, TP. Hồ Chí Minh</p>
                        </div>
                      </div>
                    </div>

                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200">
                      <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50 rounded-t-2xl">
                        <h3 className="font-bold text-slate-700 flex items-center gap-2"><Package size={18} className="text-orange-500"/> Sản phẩm trong đơn (2 món)</h3>
                      </div>
                      <div className="p-2">
                        <div className="flex items-center justify-between p-4 border-b border-slate-100">
                          <div className="flex items-center gap-4">
                            <img src="https://images.unsplash.com/photo-1586363104862-3a5e2ab60d99?auto=format&fit=crop&w=150" alt="Polo" className="w-16 h-16 rounded-xl object-cover bg-slate-100 border border-slate-200" />
                            <div>
                              <h4 className="font-bold text-slate-800 mb-1">Áo Polo Nam Cafe Khử Mùi</h4>
                              <p className="text-xs text-slate-500 font-medium">SL: <strong className="text-slate-800">1</strong> x 499.000 đ</p>
                            </div>
                          </div>
                          <div className="font-black text-slate-900">499.000 đ</div>
                        </div>
                        <div className="flex items-center justify-between p-4">
                          <div className="flex items-center gap-4">
                            <img src="https://images.unsplash.com/photo-1591195853828-11db59a44f6b?auto=format&fit=crop&w=150" alt="Short" className="w-16 h-16 rounded-xl object-cover bg-slate-100 border border-slate-200" />
                            <div>
                              <h4 className="font-bold text-slate-800 mb-1">Quần Short Thể Thao Pro 2-in-1</h4>
                              <p className="text-xs text-slate-500 font-medium">SL: <strong className="text-slate-800">1</strong> x 420.000 đ</p>
                            </div>
                          </div>
                          <div className="font-black text-slate-900">420.000 đ</div>
                        </div>
                      </div>
                      <div className="p-6 bg-slate-50 rounded-b-2xl border-t border-slate-200">
                         <div className="flex justify-between items-center"><span className="font-black text-slate-800 text-lg">Tổng tiền thanh toán:</span><span className="font-black text-orange-600 text-2xl">849.000 đ</span></div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* LỊCH SỬ MUA HÀNG */}
            {activeTab === 'history' && (
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 animate-in fade-in">
                <h2 className="text-xl font-black text-slate-800 mb-6 uppercase tracking-wide">Lịch sử mua hàng</h2>
                <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                  <Clock size={48} className="mb-4 opacity-20" />
                  <p className="font-medium">Bạn có 14 đơn hàng đã hoàn thành.</p>
                  <p className="text-sm">Vui lòng xem chi tiết trong Quản lý đơn hàng.</p>
                </div>
              </div>
            )}

            {/* ĐỊA CHỈ GIAO HÀNG */}
            {activeTab === 'address' && (
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 md:p-8 animate-in fade-in relative">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-xl font-black text-slate-800 uppercase tracking-wide">Địa chỉ giao hàng</h2>
                  <button 
                    onClick={() => setIsAddingAddress(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 transition-colors text-sm shadow-sm"
                  >
                    <Plus size={16} /> Thêm địa chỉ mới
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {addresses.map(addr => (
                    <div key={addr.id} className="border border-slate-200 rounded-xl p-5 hover:border-blue-300 hover:shadow-md transition-all bg-white relative group">
                      {addr.isDefault && (
                        <span className="absolute top-4 right-4 text-[10px] font-bold px-2 py-0.5 bg-blue-50 text-blue-600 border border-blue-200 rounded">Mặc định</span>
                      )}
                      <div className="flex items-center gap-3 mb-2">
                        <span className="font-bold text-slate-900">{addr.name}</span>
                        <span className="w-1 h-1 bg-slate-300 rounded-full"></span>
                        <span className="text-sm font-medium text-slate-600">{addr.phone}</span>
                      </div>
                      <p className="text-sm text-slate-600 leading-relaxed mb-4">{addr.address}</p>
                      <div className="flex items-center gap-4 text-sm font-bold">
                        <button className="text-blue-600 hover:text-blue-800">Cập nhật</button>
                        {!addr.isDefault && (
                          <button 
                            onClick={() => {
                              setAddresses(addresses.map(a => ({ ...a, isDefault: a.id === addr.id })));
                            }}
                            className="text-slate-400 hover:text-slate-600"
                          >
                            Thiết lập mặc định
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </main>
        </div>
      </div>

      {/* MODAL THÊM ĐỊA CHỈ */}
      {isAddingAddress && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setIsAddingAddress(false)}></div>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg relative z-10 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between p-6 border-b border-slate-100">
              <h2 className="text-lg font-black text-slate-900 uppercase">Thêm địa chỉ mới</h2>
              <button onClick={() => setIsAddingAddress(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                <X size={24} />
              </button>
            </div>
            <form onSubmit={handleSaveAddress} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Họ và tên</label>
                  <input 
                    required 
                    type="text" 
                    value={newAddrName} 
                    onChange={e => setNewAddrName(e.target.value)} 
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-medium" 
                    placeholder="VD: Nguyễn Văn A" 
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Số điện thoại</label>
                  <input 
                    required 
                    type="tel" 
                    value={newAddrPhone} 
                    onChange={e => setNewAddrPhone(e.target.value)} 
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-medium" 
                    placeholder="VD: 0912345678" 
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Địa chỉ cụ thể</label>
                <textarea 
                  required 
                  value={newAddrDetail} 
                  onChange={e => setNewAddrDetail(e.target.value)} 
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none h-24 resize-none font-medium" 
                  placeholder="Số nhà, đường, phường/xã, quận/huyện, tỉnh/thành phố..."
                ></textarea>
              </div>
              <div>
                <label className="flex items-center gap-2 cursor-pointer text-sm font-bold text-slate-700">
                  <input 
                    type="checkbox" 
                    checked={newAddrIsDefault}
                    onChange={e => setNewAddrIsDefault(e.target.checked)}
                    className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500" 
                  />
                  Đặt làm địa chỉ mặc định
                </label>
              </div>
              <div className="pt-4 flex gap-4">
                <button type="submit" className="flex-1 py-3 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 transition-colors">
                  Lưu địa chỉ
                </button>
                <button type="button" onClick={() => setIsAddingAddress(false)} className="flex-1 py-3 bg-slate-100 text-slate-700 font-bold rounded-lg hover:bg-slate-200 transition-colors">
                  Hủy bỏ
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

const ArrowRightIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 12h14M12 5l7 7-7 7"/>
  </svg>
);
