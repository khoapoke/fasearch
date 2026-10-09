import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '@/features/auth/context/AuthContext';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { 
  Shield, Server, Users, Database, LogOut, Settings, Bell, ChevronRight, Camera, Save, Lock 
} from 'lucide-react';

export const AdminLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isAnimating, setIsAnimating] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  useEffect(() => {
    setIsAnimating(true);
    const timer = setTimeout(() => setIsAnimating(false), 300);
    return () => clearTimeout(timer);
  }, [location.pathname]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    setTimeout(() => {
      alert('Đã cập nhật thông tin quản trị viên thành công!');
      setIsProfileOpen(false);
    }, 500);
  };

  const menuItems = [
    { icon: Server, label: 'Tổng quan Hệ thống', path: '/admin' },
    { icon: Users, label: 'Tài khoản & Phân quyền', path: '/admin/rbac' },
    { icon: Database, label: 'Sao lưu & Phục hồi', path: '/admin/backup' },
    { icon: Shield, label: 'Bảo mật & Cấu hình', path: '/admin/ai-settings' },
  ];

  return (
    <div className="min-h-screen flex bg-surface-subtle font-sans">
      {/* Sidebar - Unified with Manager Layout (White Glassmorphism & Primary Orange Theme) */}
      <aside className="w-64 bg-white/95 backdrop-blur-md border-r border-charcoal-200 flex flex-col hidden md:flex fixed h-full z-20 shadow-[4px_0_24px_rgba(0,0,0,0.02)]">
        <div className="h-16 flex items-center px-6 border-b border-charcoal-100">
          <div className="text-xl font-extrabold text-charcoal-900 tracking-tight flex items-center gap-2 group cursor-pointer" onClick={() => navigate('/admin')}>
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-orange-600 flex items-center justify-center text-white shadow-lg group-hover:rotate-12 transition-transform duration-300">
              <span className="font-black text-sm">F</span>
            </div>
            <span>FAS<span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-orange-500">ADMIN</span></span>
          </div>
        </div>
        
        <nav className="flex-1 overflow-y-auto py-6 px-4 space-y-2 scrollbar-hide">
          <div className="px-4 mb-2 text-xs font-bold text-charcoal-400 uppercase tracking-wider">Hệ thống cốt lõi</div>
          {menuItems.map((item, idx) => {
            const isActive = item.path === '/admin' 
              ? location.pathname === '/admin' 
              : location.pathname.startsWith(item.path);

            return (
              <Link
                key={idx}
                to={item.path}
                className={`group w-full flex items-center gap-3 px-4 py-3 rounded-xl font-semibold text-sm transition-all duration-300 relative overflow-hidden ${
                  isActive 
                    ? 'text-white shadow-md' 
                    : 'text-charcoal-600 hover:bg-charcoal-50 hover:text-charcoal-900'
                }`}
                style={{ animationDelay: `${idx * 50}ms` }}
              >
                {isActive && (
                  <div className="absolute inset-0 bg-gradient-to-r from-primary to-orange-500 z-0"></div>
                )}
                <div className="relative z-10 flex items-center gap-3 group-hover:translate-x-1 transition-transform duration-300">
                  <item.icon size={18} className={isActive ? 'text-white' : 'text-charcoal-400 group-hover:text-primary transition-colors'} />
                  {item.label}
                </div>
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-charcoal-100 bg-white/50 backdrop-blur-sm">
          <div 
            onClick={() => setIsProfileOpen(true)}
            className="flex items-center gap-3 mb-4 p-3 rounded-xl hover:bg-white hover:shadow-sm cursor-pointer transition-all duration-300 group border border-transparent hover:border-charcoal-100"
            title="Chỉnh sửa hồ sơ quản trị viên"
          >
            <div className="relative">
              <img src={user?.avatar} alt="Avatar" className="w-10 h-10 rounded-full border-2 border-transparent group-hover:border-primary object-cover transition-colors duration-300" />
              <div className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 border-2 border-white rounded-full"></div>
            </div>
            <div className="flex-1 overflow-hidden">
              <p className="text-sm font-bold text-charcoal-900 truncate group-hover:text-primary transition-colors">{user?.name}</p>
              <p className="text-xs text-charcoal-500 truncate font-medium">System Admin</p>
            </div>
            <Settings size={16} className="text-charcoal-400 group-hover:text-primary opacity-0 group-hover:opacity-100 group-hover:rotate-90 transition-all duration-300" />
          </div>

          <button onClick={handleLogout} className="w-full flex items-center justify-center gap-2 py-2.5 text-sm font-bold text-charcoal-600 hover:text-crimson hover:bg-crimson-50 rounded-xl transition-all duration-300">
            <LogOut size={16} /> Thoát hệ thống
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 md:ml-64 flex flex-col min-h-screen bg-[#f8fafc]">
        {/* Header - Glassmorphism Light */}
        <header className="h-16 bg-white/80 backdrop-blur-md border-b border-charcoal-200/60 flex items-center justify-between px-8 sticky top-0 z-10">
          <h1 className="text-xl font-extrabold text-charcoal-900 tracking-tight drop-shadow-sm">
            {menuItems.find(i => location.pathname === i.path || (i.path !== '/admin' && location.pathname.startsWith(i.path)))?.label || 'Quản trị hệ thống'}
          </h1>
          <div className="flex items-center gap-4">
            <Badge className="bg-orange-50 text-primary hidden sm:flex border-primary/20">
              <Server size={14} className="mr-1" /> Môi trường: Production
            </Badge>
            <button className="relative p-2 text-charcoal-500 hover:bg-charcoal-100 hover:text-primary rounded-full transition-all duration-300 hover:scale-110 active:scale-95">
              <Bell size={20} />
              <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-crimson border-2 border-white rounded-full animate-pulse"></span>
            </button>
          </div>
        </header>

        {/* Page Content with transition */}
        <div className={`p-8 flex-1 overflow-y-auto transition-all duration-300 ease-out ${isAnimating ? 'opacity-0 translate-y-4' : 'opacity-100 translate-y-0'}`}>
          {children}
        </div>
      </main>

      {/* Profile Edit Modal */}
      <Modal isOpen={isProfileOpen} onClose={() => setIsProfileOpen(false)} title="Hồ sơ Quản trị viên" maxWidth="lg">
        <form onSubmit={handleSaveProfile} className="space-y-6 text-charcoal-900">
          <div className="flex items-center gap-6">
            <div className="relative group cursor-pointer">
              <img src={user?.avatar} alt="Avatar" className="w-20 h-20 rounded-full object-cover border border-charcoal-200 shadow-sm group-hover:shadow-md transition-all duration-300" />
              <div className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                <Camera size={20} className="text-white" />
              </div>
            </div>
            <div>
              <h3 className="font-bold text-charcoal-900 text-lg">{user?.name}</h3>
              <p className="text-sm text-primary font-medium">Mã NV: AD-202601</p>
            </div>
          </div>
          
          {/* Info Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-sm font-semibold text-charcoal-700 mb-1">Họ và tên</label>
              <input type="text" defaultValue={user?.name} className="w-full px-4 py-2 border border-charcoal-200 rounded-xl focus:ring-2 focus:ring-primary outline-none transition-shadow" required />
            </div>
            <div>
              <label className="block text-sm font-semibold text-charcoal-700 mb-1">Số điện thoại</label>
              <input type="tel" defaultValue="0987654321" className="w-full px-4 py-2 border border-charcoal-200 rounded-xl focus:ring-2 focus:ring-primary outline-none transition-shadow" required />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-semibold text-charcoal-700 mb-1">Email hệ thống</label>
              <input type="email" defaultValue={user?.email} disabled className="w-full px-4 py-2 border border-charcoal-200 rounded-xl bg-charcoal-50 text-charcoal-500 cursor-not-allowed outline-none" />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-semibold text-charcoal-700 mb-1">Địa chỉ liên hệ</label>
              <input type="text" defaultValue="140 Lê Trọng Tấn, P. Tây Thạnh, Q. Tân Phú" className="w-full px-4 py-2 border border-charcoal-200 rounded-xl focus:ring-2 focus:ring-primary outline-none transition-shadow" />
            </div>
          </div>

          <div className="border-t border-charcoal-100 pt-6">
            <h4 className="text-sm font-bold text-charcoal-900 mb-4 flex items-center gap-2"><Lock size={16}/> Đổi mật khẩu</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="block text-sm font-semibold text-charcoal-700 mb-1">Mật khẩu mới</label>
                <input type="password" placeholder="Bỏ trống nếu không đổi" className="w-full px-4 py-2 border border-charcoal-200 rounded-xl focus:ring-2 focus:ring-primary outline-none transition-shadow" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-charcoal-700 mb-1">Xác nhận mật khẩu</label>
                <input type="password" placeholder="Bỏ trống nếu không đổi" className="w-full px-4 py-2 border border-charcoal-200 rounded-xl focus:ring-2 focus:ring-primary outline-none transition-shadow" />
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-charcoal-100">
            <button type="button" onClick={() => setIsProfileOpen(false)} className="px-4 py-2 border border-charcoal-200 text-charcoal-700 font-semibold rounded-xl hover:bg-charcoal-50 transition-colors">Hủy bỏ</button>
            <button type="submit" className="flex items-center gap-2 px-6 py-2 bg-gradient-to-r from-primary to-orange-500 text-white font-semibold rounded-xl hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300">
              <Save size={18} /> Lưu thay đổi
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
