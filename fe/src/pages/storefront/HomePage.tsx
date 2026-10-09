import React, { useState } from 'react';
import { ArrowRight, ShieldCheck, Truck, RefreshCcw, Star } from 'lucide-react';
import { mockProducts } from '@/features/products/mocks/products.mock';
import { ProductCard } from '@/features/products/components/ProductCard';
import { Link } from 'react-router-dom';

export const HomePage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'new' | 'bestseller' | 'sale'>('new');

  const promises = [
    { icon: Truck, title: "Freeship toàn quốc", desc: "Cho đơn hàng từ 200k" },
    { icon: RefreshCcw, title: "Đổi trả 60 ngày", desc: "Đổi trả miễn phí tận nơi" },
    { icon: ShieldCheck, title: "Bảo hành 1 năm", desc: "Cam kết chất lượng 100%" }
  ];

  const categories = [
    { name: "Áo Polo", img: "https://images.unsplash.com/photo-1596755094514-f87e32f85e23?auto=format&fit=crop&w=300" },
    { name: "Áo Thun", img: "https://images.unsplash.com/photo-1576566588028-4147f3842f27?auto=format&fit=crop&w=300" },
    { name: "Sơ Mi", img: "https://images.unsplash.com/photo-1596755094514-f87e32f85e23?auto=format&fit=crop&w=300" },
    { name: "Quần Jeans", img: "https://images.unsplash.com/photo-1542272604-787c3835535d?auto=format&fit=crop&w=300" },
    { name: "Quần Tây", img: "https://images.unsplash.com/photo-1624378439575-d8705ad7ae80?auto=format&fit=crop&w=300" },
    { name: "Phụ Kiện", img: "https://images.unsplash.com/photo-1611186871348-b1ce696e52c9?auto=format&fit=crop&w=300" }
  ];

  const getFeaturedProducts = () => {
    switch(activeTab) {
      case 'new': return mockProducts.slice(4, 8);
      case 'bestseller': return mockProducts.slice(2, 6);
      case 'sale': return mockProducts.filter(p => p.discountPercent).slice(0, 4);
      default: return mockProducts.slice(4, 8);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#F4F6F8]">
      
      {/* 1. HERO SECTION - Minimal, Soft Aesthetic */}
      <section className="relative w-full h-[85vh] min-h-[600px] flex items-center justify-center overflow-hidden bg-slate-50">
        <img 
          src="https://images.unsplash.com/photo-1490481651871-ab68de25d43d?auto=format&fit=crop&q=80&w=2000" 
          alt="Elegant Fashion" 
          className="absolute inset-0 w-full h-full object-cover opacity-90 object-top scale-105 animate-[pulse_20s_ease-in-out_infinite]"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#FAFAFA] via-[#FAFAFA]/20 to-transparent"></div>
        <div className="absolute inset-0 bg-black/5"></div>
        
        <div className="relative z-10 text-center px-6 max-w-4xl mx-auto flex flex-col items-center mt-20">
          <span className="px-4 py-1.5 mb-6 text-xs font-bold text-slate-600 bg-white/60 backdrop-blur-md rounded-full shadow-sm tracking-widest uppercase">
            Bộ sưu tập mùa thu 2026
          </span>
          <h1 className="text-4xl md:text-6xl font-extrabold text-slate-800 mb-6 tracking-tight leading-tight">
            Tinh tế trong từng <br className="hidden md:block"/> <span className="text-transparent bg-clip-text bg-gradient-to-r from-slate-600 to-slate-400">chuyển động của bạn</span>
          </h1>
          <p className="text-slate-600 text-lg md:text-xl font-medium mb-10 max-w-2xl leading-relaxed">
            Khám phá những thiết kế tối giản, chất liệu mềm mại và sự thoải mái tuyệt đối cho phong cách sống hiện đại.
          </p>
          <button className="group relative px-8 py-4 bg-slate-900 text-white font-medium rounded-full overflow-hidden shadow-[0_8px_30px_rgb(0,0,0,0.12)] hover:shadow-[0_8px_30px_rgb(0,0,0,0.2)] transition-all">
            <span className="relative z-10 flex items-center gap-2">Khám phá ngay <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform"/></span>
            <div className="absolute inset-0 h-full w-0 bg-blue-600 transition-all duration-500 ease-out group-hover:w-full z-0"></div>
          </button>
        </div>
      </section>

      {/* 2. TRUST BADGES - Glassmorphism mềm mại */}
      <section className="relative z-20 max-w-6xl mx-auto px-4 w-full -mt-12 mb-16">
        <div className="bg-white/80 backdrop-blur-xl border border-white rounded-3xl p-6 md:p-8 flex flex-wrap justify-between md:justify-center gap-6 md:gap-12 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
          {promises.map((p, idx) => (
            <div key={idx} className="flex items-center gap-4 hover:-translate-y-1 transition-transform duration-300">
              <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-700 shadow-sm">
                <p.icon size={22} strokeWidth={1.5} />
              </div>
              <div>
                <h4 className="font-bold text-slate-800 text-sm">{p.title}</h4>
                <p className="text-xs text-slate-500 font-medium">{p.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 3. DANH MỤC NỔI BẬT - Aesthetic Avatars */}
      <section className="py-12 max-w-7xl mx-auto px-6 w-full">
        <div className="flex justify-between items-center mb-12">
          <div>
            <h2 className="text-2xl md:text-3xl font-extrabold text-slate-800 tracking-tight">Danh mục yêu thích</h2>
            <div className="w-16 h-1 bg-slate-200 rounded-full mt-3"></div>
          </div>
        </div>
        <div className="flex justify-center gap-6 md:gap-10 flex-wrap">
          {categories.map((cat, idx) => (
            <div key={idx} className="flex flex-col items-center gap-4 group cursor-pointer w-24 md:w-32">
              <div className="w-24 h-24 md:w-32 md:h-32 rounded-full overflow-hidden border-[4px] border-white shadow-[0_8px_30px_rgb(0,0,0,0.06)] group-hover:shadow-[0_8px_30px_rgb(0,0,0,0.12)] transition-all duration-500 relative">
                <div className="absolute inset-0 bg-slate-900/0 group-hover:bg-slate-900/10 transition-colors duration-500 z-10"></div>
                <img src={cat.img} alt={cat.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700 ease-out" />
              </div>
              <span className="text-sm font-semibold text-slate-700 group-hover:text-slate-900 text-center transition-colors">{cat.name}</span>
            </div>
          ))}
        </div>
      </section>

      {/* 4. HÀNG MỚI VỀ TUẦN NÀY (Requested Section 1) */}
      <section className="py-16 w-full bg-white">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex justify-between items-center mb-8 border-b border-slate-100 pb-4">
            <h2 className="text-2xl font-black text-slate-900 uppercase">Hàng mới về tuần này</h2>
            <Link to="/new-arrivals" className="text-sm font-bold text-blue-600 hover:text-blue-800 transition-colors">Xem thêm</Link>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-8">
            {mockProducts.slice(0, 4).map(product => (
              <div key={product.id} className="hover:-translate-y-2 transition-transform duration-500">
                <ProductCard product={product} />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 5. SẢN PHẨM NỔI BẬT (TABS) */}
      <section className="py-20 w-full bg-white">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex flex-col items-center mb-12">
            <h2 className="text-3xl md:text-4xl font-extrabold text-slate-800 mb-8 tracking-tight">Sản phẩm nổi bật</h2>
            
            {/* Soft Minimalist Tabs */}
            <div className="flex bg-slate-50 p-1.5 rounded-full border border-slate-100">
              {[
                { id: 'new', label: 'Mới ra mắt' },
                { id: 'bestseller', label: 'Bán chạy nhất' },
                { id: 'sale', label: 'Đang ưu đãi' }
              ].map(tab => (
                <button 
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`px-6 py-2.5 rounded-full font-semibold text-sm transition-all duration-300 ${
                    activeTab === tab.id 
                      ? 'bg-white text-slate-900 shadow-sm' 
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-8">
            {getFeaturedProducts().map(product => (
              <div key={product.id} className="hover:-translate-y-2 transition-transform duration-500">
                <ProductCard product={product} />
              </div>
            ))}
          </div>

          <div className="flex justify-center mt-16">
            <Link to="/collections" className="px-10 py-3.5 border border-slate-300 text-slate-700 font-semibold rounded-full hover:bg-slate-50 hover:border-slate-400 hover:text-slate-900 transition-all">
              Xem tất cả sản phẩm
            </Link>
          </div>
        </div>
      </section>

      {/* 6. THOẢI MÁI MỌI KHOẢNH KHẮC BANNER (Requested Banner) */}
      <section className="py-12 w-full bg-white">
        <div className="max-w-7xl mx-auto px-6">
          <div className="bg-[#F4F5F7] rounded-3xl p-8 md:p-14 flex flex-col md:flex-row justify-between items-center md:items-center gap-8">
            <div className="max-w-2xl text-left w-full">
              <h2 className="text-2xl md:text-3xl font-black text-slate-900 mb-3 tracking-tight">Thoải mái mọi khoảnh khắc</h2>
              <p className="text-slate-600 font-medium leading-relaxed max-w-lg">
                Sự kết hợp hoàn hảo giữa công nghệ vải khô thoáng và kiểu dáng ôm vừa vặn, mang lại sự tự tin trong mọi chuyển động.
              </p>
            </div>
            <div className="shrink-0">
              <Link to="/collections" className="inline-block px-10 py-4 bg-[#111827] text-white font-bold rounded-xl hover:bg-black hover:scale-105 transition-all whitespace-nowrap shadow-md">
                Mua sắm ngay
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* 7. BỘ SƯU TẬP MÙA THU (Requested Section 2) */}
      <section className="py-16 w-full bg-white">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex justify-between items-center mb-8 border-b border-slate-100 pb-4">
            <h2 className="text-2xl font-black text-slate-900 uppercase">Bộ sưu tập mùa thu</h2>
            <Link to="/collections" className="text-sm font-bold text-blue-600 hover:text-blue-800 transition-colors">Xem thêm</Link>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-8">
            {mockProducts.slice(0, 4).reverse().map(product => (
              <div key={product.id} className="hover:-translate-y-2 transition-transform duration-500">
                <ProductCard product={product} />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 8. VỀ CHÚNG TÔI BANNERS - Pastel / Light Aesthetic */}
      <section className="py-24 max-w-7xl mx-auto px-6 w-full">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12">
          <div className="relative h-[450px] rounded-[2.5rem] overflow-hidden group cursor-pointer shadow-[0_8px_30px_rgb(0,0,0,0.06)] bg-[#FDF8F5]">
            <img src="https://images.unsplash.com/photo-1618354691373-d851c5c3a990?auto=format&fit=crop&q=80" alt="Exceed" className="absolute inset-0 w-full h-full object-cover mix-blend-multiply opacity-80 group-hover:scale-105 transition-transform duration-700 ease-out" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent"></div>
            <div className="absolute bottom-10 left-10 right-10">
              <span className="px-3 py-1 bg-white/90 rounded-full text-xs font-bold text-slate-800 mb-4 inline-block">Chất liệu tự nhiên</span>
              <h3 className="text-3xl font-extrabold text-white mb-3">Sợi Bông Thuần Khiết</h3>
              <p className="text-white/90 font-medium mb-6 line-clamp-2 leading-relaxed">Sự mềm mại đánh thức mọi giác quan. Chất liệu an toàn tuyệt đối cho làn da nhạy cảm nhất.</p>
              <span className="inline-flex items-center gap-2 text-white font-bold group-hover:gap-4 transition-all">Khám phá ngay <ArrowRight size={18}/></span>
            </div>
          </div>

          <div className="relative h-[450px] rounded-[2.5rem] overflow-hidden group cursor-pointer shadow-[0_8px_30px_rgb(0,0,0,0.06)] bg-[#F0F4F8]">
            <img src="https://images.unsplash.com/photo-1550995694-3f5f4a7e1bd2?auto=format&fit=crop&q=80" alt="Active" className="absolute inset-0 w-full h-full object-cover mix-blend-multiply opacity-80 group-hover:scale-105 transition-transform duration-700 ease-out" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent"></div>
            <div className="absolute bottom-10 left-10 right-10">
              <span className="px-3 py-1 bg-white/90 rounded-full text-xs font-bold text-slate-800 mb-4 inline-block">Công nghệ dệt</span>
              <h3 className="text-3xl font-extrabold text-white mb-3">Thoáng Khí Tuyệt Đối</h3>
              <p className="text-white/90 font-medium mb-6 line-clamp-2 leading-relaxed">Cấu trúc vi lỗ giúp luồng không khí lưu thông tối đa, mang lại cảm giác mát mẻ suốt ngày dài.</p>
              <span className="inline-flex items-center gap-2 text-white font-bold group-hover:gap-4 transition-all">Tìm hiểu thêm <ArrowRight size={18}/></span>
            </div>
          </div>
        </div>
      </section>

      {/* 9. SOCIAL PROOF / REVIEWS - Sạch, Sáng, Đáng tin cậy */}
      <section className="bg-slate-50 py-24 w-full border-t border-slate-100">
        <div className="max-w-7xl mx-auto px-6 text-center">
          <div className="flex flex-col items-center mb-16">
            <h2 className="text-3xl font-extrabold text-slate-800 mb-4 tracking-tight">Khách hàng nói gì về chúng tôi?</h2>
            <p className="text-slate-500 font-medium max-w-2xl">Hơn 100,000+ khách hàng đã trải nghiệm và hài lòng với chất lượng sản phẩm cũng như dịch vụ chăm sóc tận tâm.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { name: 'Lan Anh', item: 'Váy Đầm Vintage', text: 'Chất vải mềm rũ siêu thích, mặc lên form rất tôn dáng. Giao hàng cực kỳ nhanh và đóng gói thơm tho, chỉn chu.' },
              { name: 'Minh Khang', item: 'Áo Thun Basic', text: 'Mua lần 2 rồi, áo giặt máy không bị xù lông hay mất form. Rất ưng ý với cách chăm sóc khách hàng của shop.' },
              { name: 'Hoàng Oanh', item: 'Áo Khoác Bomber', text: 'Màu sắc y như hình chụp, mặc lên nhẹ nhàng nhưng rất ấm. Sẽ tiếp tục ủng hộ shop trong bộ sưu tập thu đông tới.' }
            ].map((review, i) => (
              <div key={i} className="bg-white p-8 rounded-[2rem] text-left hover:-translate-y-2 transition-transform duration-500 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100">
                <div className="flex text-yellow-400 mb-6 gap-1">
                  <Star size={18} className="fill-current" /><Star size={18} className="fill-current" /><Star size={18} className="fill-current" /><Star size={18} className="fill-current" /><Star size={18} className="fill-current" />
                </div>
                <p className="text-slate-600 font-medium leading-relaxed mb-8 min-h-[80px]">
                  "{review.text}"
                </p>
                <div className="flex items-center gap-4 pt-6 border-t border-slate-100">
                  <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center font-bold text-slate-700 text-lg">
                    {review.name.charAt(0)}
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-800">{review.name}</h4>
                    <p className="text-xs text-slate-500 font-medium">Đã mua {review.item}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

    </div>
  );
};
