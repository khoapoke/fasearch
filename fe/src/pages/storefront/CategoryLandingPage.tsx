import React, { useEffect } from 'react';
import { useParams, useLocation, Link } from 'react-router-dom';
import { mockProducts } from '@/features/products/mocks/products.mock';
import { ProductCard } from '@/features/products/components/ProductCard';

export const CategoryLandingPage: React.FC<{ defaultTitle?: string }> = ({ defaultTitle }) => {
  const { slug } = useParams<{ slug: string }>();
  const location = useLocation();

  let pageTitle = defaultTitle || 'Thời trang';
  let bannerImg = 'https://images.unsplash.com/photo-1441984904996-e0b6ba687e04?auto=format&fit=crop&q=80&w=2000';
  let subCategories: { name: string, img: string }[] = [];
  
  // Define dynamic product sections to render based on the current category
  let productSections: { title: string; subtitle?: string; products: any[] }[] = [];

  // Helper to get random subset of mockProducts to simulate different sections
  const getMockSlice = (start: number, count: number = 4) => mockProducts.slice(start, start + count);

  if (slug === 'nam') { 
    pageTitle = 'Thời trang Nam'; 
    bannerImg = 'https://images.unsplash.com/photo-1617137968427-85924c800a22?auto=format&fit=crop&q=80&w=2000'; 
    subCategories = [
      { name: 'Áo Thun', img: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=150' },
      { name: 'Áo Polo', img: 'https://images.unsplash.com/photo-1586363104862-3a5e2ab60d99?auto=format&fit=crop&w=150' },
      { name: 'Áo Sơ Mi', img: 'https://images.unsplash.com/photo-1596755094514-f87e32f85e23?auto=format&fit=crop&w=150' },
      { name: 'Quần Short', img: 'https://images.unsplash.com/photo-1591195853828-11db59a44f6b?auto=format&fit=crop&w=150' },
      { name: 'Đồ Thể Thao', img: 'https://images.unsplash.com/photo-1518459031867-a89b944bffe4?auto=format&fit=crop&w=150' },
    ];
    productSections = [
      { title: 'SẢN PHẨM CHẠY BỘ', products: getMockSlice(0, 4) },
      { title: 'ÁO POLO NAM', products: getMockSlice(4, 4) },
      { title: 'QUẦN NAM BÁN CHẠY', products: getMockSlice(2, 4) },
    ];
  } else if (slug === 'nu') { 
    pageTitle = 'Thời trang Nữ'; 
    bannerImg = 'https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&q=80&w=2000';
    subCategories = [
      { name: 'Áo Thun Nữ', img: 'https://images.unsplash.com/photo-1503342217505-b0a15ec3261c?auto=format&fit=crop&w=150' },
      { name: 'Váy / Đầm', img: 'https://images.unsplash.com/photo-1595777457583-95e059d581b8?auto=format&fit=crop&w=150' },
      { name: 'Quần Nữ', img: 'https://images.unsplash.com/photo-1541099649105-f69ad21f3246?auto=format&fit=crop&w=150' },
      { name: 'Chân váy', img: 'https://images.unsplash.com/photo-1583496661160-c588c2569283?auto=format&fit=crop&w=150' },
    ];
    productSections = [
      { title: 'VÁY ĐẦM THIẾT KẾ', products: getMockSlice(1, 4) },
      { title: 'ÁO KIỂU NỮ', products: getMockSlice(5, 4) },
      { title: 'BỘ SƯU TẬP CÔNG SỞ', products: getMockSlice(0, 4) },
    ];
  } else if (slug === 'phu-kien') { 
    pageTitle = 'Phụ kiện'; 
    bannerImg = 'https://images.unsplash.com/photo-1511499767150-a48a237f0083?auto=format&fit=crop&q=80&w=2000';
    productSections = [
      { title: 'MŨ / NÓN BÁN CHẠY', products: getMockSlice(0, 4) },
      { title: 'TRANG SỨC BẠC TỐI GIẢN', products: getMockSlice(4, 4) },
    ];
  } else if (location.pathname === '/new-arrivals') { 
    pageTitle = 'Sản phẩm mới'; 
    bannerImg = 'https://images.unsplash.com/photo-1556821840-3a63f95609a7?auto=format&fit=crop&q=80&w=2000';
    productSections = [
      { title: 'HÀNG MỚI VỀ TUẦN NÀY', products: getMockSlice(6, 4) },
      { title: 'BỘ SƯU TẬP MÙA THU', products: getMockSlice(0, 4) },
    ];
  } else if (location.pathname === '/sale') { 
    pageTitle = 'Đang giảm giá (Sale)'; 
    bannerImg = 'https://images.unsplash.com/photo-1607083206968-13611e3d76db?auto=format&fit=crop&q=80&w=2000';
    productSections = [
      { title: 'FLASH SALE (GIẢM ĐẾN 50%)', products: getMockSlice(0, 4) },
      { title: 'COMBO TIẾT KIỆM', products: getMockSlice(4, 4) },
    ];
  }

  // Fallback if no specific sections defined
  if (productSections.length === 0) {
    productSections = [
      { title: 'SẢN PHẨM BÁN CHẠY', products: getMockSlice(0, 4) },
      { title: 'HÀNG MỚI VỀ', products: getMockSlice(4, 4) },
    ];
  }

  // Cuộn lên đầu trang khi chuyển tab
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);

  return (
    <div className="bg-white min-h-screen animate-in fade-in duration-500 pb-20">
      
      {/* HERO BANNER */}
      <div className="relative w-full h-[300px] md:h-[450px] bg-slate-900 overflow-hidden">
        <img src={bannerImg} alt={pageTitle} className="absolute inset-0 w-full h-full object-cover opacity-70" />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-900/80 to-transparent"></div>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-4">
          <h1 className="text-4xl md:text-6xl font-black text-white uppercase tracking-tight mb-4 drop-shadow-lg">{pageTitle}</h1>
          <p className="text-white/90 text-sm md:text-base max-w-xl font-medium">Khám phá bộ sưu tập mới nhất với chất liệu cao cấp và thiết kế tối ưu cho trải nghiệm thoải mái cả ngày dài.</p>
        </div>
      </div>

      {/* SUB-CATEGORIES (Horizontal Scroll) */}
      {subCategories.length > 0 && (
        <div className="max-w-7xl mx-auto px-4 md:px-6 py-10">
          <div className="flex gap-4 md:gap-8 overflow-x-auto pb-4 custom-scrollbar justify-start md:justify-center">
            {subCategories.map((cat, idx) => (
              <Link to={`/collections?type=${cat.name}`} key={idx} className="flex flex-col items-center gap-3 group shrink-0 w-24">
                <div className="w-20 h-20 rounded-full overflow-hidden border-2 border-transparent group-hover:border-blue-600 transition-all duration-300 p-1 bg-white shadow-sm group-hover:shadow-md">
                  <img src={cat.img} alt={cat.name} className="w-full h-full object-cover rounded-full group-hover:scale-110 transition-transform duration-500" />
                </div>
                <span className="text-xs font-bold text-slate-700 group-hover:text-blue-600 text-center leading-tight">{cat.name}</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* DYNAMIC PRODUCT SECTIONS */}
      {productSections.map((section, index) => (
        <section key={index} className="max-w-7xl mx-auto px-4 md:px-6 pt-16">
          <div className="flex items-end justify-between mb-8 pb-4 border-b border-slate-100">
            <h2 className="text-2xl md:text-3xl font-black text-slate-900 uppercase tracking-tight">{section.title}</h2>
            <Link to="/collections" className="text-sm font-bold text-blue-600 hover:text-blue-800 transition-colors hidden sm:block hover:underline">
              Xem thêm
            </Link>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
            {section.products.map(product => (
              <ProductCard key={`${section.title}-${product.id}`} product={product} />
            ))}
          </div>
        </section>
      ))}

      {/* PROMO BANNER NHỎ CUỐI TRANG */}
      <section className="max-w-7xl mx-auto px-4 md:px-6 py-20">
        <div className="w-full bg-[#f3f4f6] rounded-2xl p-8 md:p-12 flex flex-col md:flex-row items-center justify-between gap-8">
          <div>
            <h3 className="text-2xl font-black text-slate-900 mb-2">Thoải mái mọi khoảnh khắc</h3>
            <p className="text-slate-600 font-medium max-w-lg">Sự kết hợp hoàn hảo giữa công nghệ vải khô thoáng và kiểu dáng ôm vừa vặn, mang lại sự tự tin trong mọi chuyển động.</p>
          </div>
          <Link to="/collections" className="px-8 py-3 bg-slate-900 text-white font-bold rounded-xl hover:bg-blue-600 transition-colors whitespace-nowrap shadow-md">
            Mua sắm ngay
          </Link>
        </div>
      </section>

    </div>
  );
};
