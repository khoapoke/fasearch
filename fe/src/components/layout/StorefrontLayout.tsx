import React, { useState } from 'react';
import { Outlet, Link, useNavigate } from 'react-router-dom';
import { Search, ShoppingBag, User, Menu, X, ArrowRight, ShieldCheck, Truck, RefreshCcw } from 'lucide-react';
import { useAuth } from '@/features/auth/context/AuthContext';
import { useCart } from '@/features/cart/context/CartContext';
import { Drawer } from '@/components/ui/Drawer';
import { MiniCart } from '@/features/cart/components/MiniCart';
import { AiSearchModal } from '@/features/products/components/AiSearchModal';

export const StorefrontLayout: React.FC<{ children?: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const { cartCount } = useCart();
  const navigate = useNavigate();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isAiSearchOpen, setIsAiSearchOpen] = useState(false);

  const mainLinks = [
    { label: 'Danh mục', path: '/collections' },
    { label: 'Sản phẩm mới', path: '/new-arrivals' },
    { label: 'Thời trang Nam', path: '/category/nam' },
    { label: 'Thời trang Nữ', path: '/category/nu' },
    { label: 'Phụ kiện', path: '/category/phu-kien' },
    { label: 'Sale', path: '/sale', highlight: true },
  ];

  return (
    <div className="min-h-screen flex flex-col font-sans bg-white selection:bg-primary selection:text-white">
      
      {/* Top Banner (Promo) */}
      <div className="bg-charcoal-900 text-white text-xs py-2 text-center font-bold tracking-widest uppercase">
        <span className="animate-pulse mr-2">🔥</span> Mua 2 giảm 10% - Mua 3 giảm 20%. Freeship đơn từ 200k.
      </div>

      {/* Main Header (Sticky) */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-charcoal-100 transition-all duration-300">
        <div className="max-w-7xl mx-auto px-4 md:px-6 h-16 flex items-center justify-between">
          
          {/* Left: Mobile Menu & Logo */}
          <div className="flex items-center gap-4 flex-1 md:flex-none">
            <button 
              onClick={() => setIsMobileMenuOpen(true)}
              className="md:hidden p-2 text-charcoal-600 hover:text-charcoal-900 transition-colors"
            >
              <Menu size={24} />
            </button>
            
            <Link to="/" className="text-2xl font-black text-charcoal-900 tracking-tight flex items-center gap-1 group">
              <div className="w-8 h-8 rounded-lg bg-charcoal-900 flex items-center justify-center text-white group-hover:bg-primary transition-colors">
                <span className="font-black text-sm">F</span>
              </div>
              <span className="hidden sm:inline-block mt-0.5">FASHION<span className="text-primary">SEARCH</span></span>
            </Link>
          </div>

          {/* Center: Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-8 absolute left-1/2 -translate-x-1/2">
            {mainLinks.map((link, idx) => (
              <Link 
                key={idx} 
                to={link.path}
                className={`text-sm font-bold uppercase tracking-wide transition-colors ${
                  link.highlight ? 'text-red-600 hover:text-red-700' : 'text-charcoal-700 hover:text-primary'
                }`}
              >
                {link.label}
              </Link>
            ))}
          </nav>

          {/* Right: Actions */}
          <div className="flex items-center gap-2 md:gap-4 flex-1 justify-end">
            <button 
              onClick={() => setIsAiSearchOpen(true)}
              className="hidden md:flex items-center gap-2 bg-charcoal-50 hover:bg-charcoal-100 px-4 py-2 rounded-full text-sm font-medium text-charcoal-600 transition-colors border border-charcoal-100"
            >
              <Search size={16} /> Tìm kiếm...
            </button>
            <button 
              onClick={() => setIsAiSearchOpen(true)}
              className="md:hidden p-2 text-charcoal-600 hover:text-primary transition-colors"
            >
              <Search size={22} />
            </button>
            
            <Link 
              to={user ? "/profile" : "/login"} 
              className={user ? "w-9 h-9 rounded-full border-2 border-charcoal-300 text-charcoal-800 hover:border-primary hover:text-primary flex items-center justify-center transition-colors mx-1" : "p-2 text-charcoal-600 hover:text-primary transition-colors"}
            >
              <User size={user ? 18 : 22} />
            </Link>
            
            <button 
              onClick={() => setIsCartOpen(true)}
              className="p-2 text-charcoal-600 hover:text-primary transition-colors relative group"
            >
              <ShoppingBag size={22} />
              {cartCount > 0 && (
                <span className="absolute top-1 right-0 w-4 h-4 bg-primary text-white text-[10px] font-bold flex items-center justify-center rounded-full group-hover:scale-110 transition-transform">
                  {cartCount}
                </span>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Main Page Content */}
      <main className="flex-1 w-full bg-white">
        {children}
      </main>

      {/* Footer (Coolmate style clean footer) */}
      <footer className="bg-charcoal-50 border-t border-charcoal-200 py-16 text-charcoal-600 w-full mt-auto">
        <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 md:grid-cols-4 gap-12">
          <div className="space-y-4">
            <div className="text-xl font-black text-charcoal-900 flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-charcoal-900 flex items-center justify-center text-white">
                <span className="font-black text-sm">F</span>
              </div>
              FASHIONSEARCH
            </div>
            <p className="text-sm font-medium leading-relaxed">Tiên phong mang đến giải pháp thời trang toàn diện, kết hợp công nghệ AI tìm kiếm đột phá.</p>
            <div className="pt-4 flex gap-4">
              {/* Fake Social Icons */}
              <div className="w-8 h-8 rounded-full bg-charcoal-200 hover:bg-primary hover:text-white transition-colors cursor-pointer"></div>
              <div className="w-8 h-8 rounded-full bg-charcoal-200 hover:bg-primary hover:text-white transition-colors cursor-pointer"></div>
              <div className="w-8 h-8 rounded-full bg-charcoal-200 hover:bg-primary hover:text-white transition-colors cursor-pointer"></div>
            </div>
          </div>
          
          <div>
            <h3 className="font-bold text-charcoal-900 mb-6 uppercase tracking-wider text-sm">Về chúng tôi</h3>
            <ul className="space-y-3 text-sm font-medium">
              <li><Link to="#" className="hover:text-primary transition-colors">Câu chuyện thương hiệu</Link></li>
              <li><Link to="#" className="hover:text-primary transition-colors">Tuyển dụng</Link></li>
              <li><Link to="#" className="hover:text-primary transition-colors">Tin tức công nghệ</Link></li>
            </ul>
          </div>
          
          <div>
            <h3 className="font-bold text-charcoal-900 mb-6 uppercase tracking-wider text-sm">Hỗ trợ khách hàng</h3>
            <ul className="space-y-3 text-sm font-medium">
              <li><Link to="#" className="hover:text-primary transition-colors">Chính sách đổi trả 60 ngày</Link></li>
              <li><Link to="#" className="hover:text-primary transition-colors">Chính sách bảo mật</Link></li>
              <li><Link to="#" className="hover:text-primary transition-colors">Hướng dẫn chọn size</Link></li>
            </ul>
          </div>

          <div>
            <h3 className="font-bold text-charcoal-900 mb-6 uppercase tracking-wider text-sm">Đăng ký nhận tin</h3>
            <p className="text-sm font-medium mb-4">Nhận ngay mã giảm giá 10% cho đơn hàng đầu tiên.</p>
            <div className="flex">
              <input type="email" placeholder="Email của bạn..." className="px-4 py-2 w-full border border-charcoal-300 rounded-l-xl focus:outline-none focus:border-primary text-sm" />
              <button className="bg-charcoal-900 text-white px-4 py-2 rounded-r-xl hover:bg-primary transition-colors">
                <ArrowRight size={18} />
              </button>
            </div>
          </div>
        </div>
        
        <div className="max-w-7xl mx-auto px-6 mt-16 pt-8 border-t border-charcoal-200 text-sm font-medium flex flex-col md:flex-row justify-between items-center gap-4">
          <p>© 2026 FashionSearch. Trực thuộc Đồ án Tốt nghiệp.</p>
          <div className="flex items-center gap-6">
            <span className="flex items-center gap-1.5"><ShieldCheck size={16}/> Thanh toán an toàn</span>
            <span className="flex items-center gap-1.5"><RefreshCcw size={16}/> Đổi trả 60 ngày</span>
            <span className="flex items-center gap-1.5"><Truck size={16}/> Giao hàng siêu tốc</span>
          </div>
        </div>
      </footer>

      {/* Slide-over Mini Cart */}
      <Drawer isOpen={isCartOpen} onClose={() => setIsCartOpen(false)} title="Giỏ hàng của bạn" position="right">
        <MiniCart onClose={() => setIsCartOpen(false)} />
      </Drawer>

      {/* AI Search Modal */}
      <AiSearchModal isOpen={isAiSearchOpen} onClose={() => setIsAiSearchOpen(false)} />

    </div>
  );
};
