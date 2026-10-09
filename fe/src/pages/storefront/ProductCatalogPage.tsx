import React, { useState, useEffect } from 'react';
import { useParams, useLocation, Link } from 'react-router-dom';
import { Filter, ChevronDown, ChevronRight, SlidersHorizontal } from 'lucide-react';
import { mockProducts } from '@/features/products/mocks/products.mock';
import { ProductCard } from '@/features/products/components/ProductCard';

export const ProductCatalogPage: React.FC<{ defaultTitle?: string }> = ({ defaultTitle }) => {
  const { slug } = useParams<{ slug: string }>();
  const location = useLocation();

  // Determine page title and active filters based on URL
  let pageTitle = defaultTitle || 'Tất cả sản phẩm';
  let bannerImg = 'https://images.unsplash.com/photo-1441984904996-e0b6ba687e04?auto=format&fit=crop&q=80&w=2000';
  
  if (slug === 'nam') { pageTitle = 'Thời trang Nam'; bannerImg = 'https://images.unsplash.com/photo-1617137968427-85924c800a22?auto=format&fit=crop&q=80&w=2000'; }
  if (slug === 'nu') { pageTitle = 'Thời trang Nữ'; bannerImg = 'https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&q=80&w=2000'; }
  if (slug === 'phu-kien') { pageTitle = 'Phụ kiện Thời trang'; bannerImg = 'https://images.unsplash.com/photo-1511499767150-a48a237f0083?auto=format&fit=crop&q=80&w=2000'; }
  if (location.pathname === '/new-arrivals') { pageTitle = 'Sản phẩm mới'; bannerImg = 'https://images.unsplash.com/photo-1556821840-3a63f95609a7?auto=format&fit=crop&q=80&w=2000'; }
  if (location.pathname === '/sale') { pageTitle = 'Sản phẩm Đang Sale'; bannerImg = 'https://images.unsplash.com/photo-1607083206968-13611e3d76db?auto=format&fit=crop&q=80&w=2000'; }

  // Checkbox states
  const [selectedFilters, setSelectedFilters] = useState<{ [key: string]: string[] }>({
    gender: slug === 'nam' ? ['Nam'] : slug === 'nu' ? ['Nữ'] : [],
    type: [],
    price: [],
    size: [],
    color: [],
    location: []
  });

  const filterOptions = {
    gender: ['Nam', 'Nữ', 'Unisex'],
    type: ['Áo thun', 'Áo sơ mi', 'Áo polo', 'Áo khoác', 'Áo len', 'Quần âu', 'Quần jean', 'Quần short', 'Váy đầm', 'Trang sức Bạc', 'Trang sức Vàng', 'Giày thể thao', 'Giày da', 'Dép', 'Mũ / Nón', 'Thắt lưng'],
    price: ['Dưới 200.000đ', '200.000đ - 500.000đ', '500.000đ - 1.000.000đ', 'Trên 1.000.000đ'],
    size: ['S', 'M', 'L', 'XL', 'XXL', 'Freesize', '38', '39', '40', '41', '42'],
    color: [
      { name: 'Đen', hex: '#000000' }, { name: 'Trắng', hex: '#FFFFFF' }, 
      { name: 'Xám', hex: '#9CA3AF' }, { name: 'Xanh Navy', hex: '#1E3A8A' }, 
      { name: 'Be (Beige)', hex: '#F5F5DC' }, { name: 'Đỏ', hex: '#DC2626' }
    ],
    location: ['Hà Nội', 'TP. Hồ Chí Minh', 'Đà Nẵng', 'Hải Phòng']
  };

  const toggleFilter = (category: string, value: string) => {
    setSelectedFilters(prev => {
      const current = prev[category];
      const updated = current.includes(value) 
        ? current.filter(item => item !== value)
        : [...current, value];
      return { ...prev, [category]: updated };
    });
  };

  return (
    <div className="bg-white min-h-screen animate-in fade-in duration-500">
      
      {/* Coolmate-style Category Banner */}
      <div className="relative w-full h-[250px] md:h-[350px] bg-charcoal-900 overflow-hidden">
        <img src={bannerImg} alt={pageTitle} className="absolute inset-0 w-full h-full object-cover opacity-70" />
        <div className="absolute inset-0 bg-gradient-to-t from-charcoal-900/90 to-transparent"></div>
        <div className="absolute bottom-0 left-0 w-full p-8 md:p-12 max-w-7xl mx-auto flex flex-col justify-end">
          <div className="flex items-center text-xs text-slate-300 font-bold mb-3 uppercase tracking-wider">
            <Link to="/" className="hover:text-white transition-colors">Trang chủ</Link>
            <ChevronRight size={14} className="mx-2" />
            <span className="text-white">{pageTitle}</span>
          </div>
          <h1 className="text-3xl md:text-5xl font-black text-white uppercase tracking-tight">{pageTitle}</h1>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 md:px-6 py-8 md:py-12 flex flex-col lg:flex-row gap-8">
        
        {/* LEFT SIDEBAR: FILTERS */}
        <aside className="w-full lg:w-64 shrink-0">
          <div className="flex items-center gap-2 font-black text-lg text-charcoal-900 mb-6 uppercase tracking-wider border-b border-charcoal-100 pb-4">
            <Filter size={20} /> Bộ lọc sản phẩm
          </div>
          
          <div className="space-y-6 sticky top-24">
            
            {/* Filter: Gender */}
            <div className="border-b border-charcoal-100 pb-6">
              <h3 className="font-bold text-charcoal-900 mb-4 uppercase text-sm tracking-wide">Giới tính</h3>
              <div className="space-y-3">
                {filterOptions.gender.map(item => (
                  <label key={item} className="flex items-center gap-3 cursor-pointer group">
                    <input 
                      type="checkbox" 
                      checked={selectedFilters.gender.includes(item)}
                      onChange={() => toggleFilter('gender', item)}
                      className="w-5 h-5 rounded border-charcoal-300 text-charcoal-900 focus:ring-charcoal-900 cursor-pointer transition-colors"
                    />
                    <span className="text-charcoal-700 text-sm font-medium group-hover:text-primary transition-colors">{item}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Filter: Type (Loại sản phẩm) */}
            <div className="border-b border-charcoal-100 pb-6">
              <h3 className="font-bold text-charcoal-900 mb-4 uppercase text-sm tracking-wide">Loại sản phẩm</h3>
              <div className="space-y-3 max-h-64 overflow-y-auto pr-2 custom-scrollbar">
                {filterOptions.type.map(item => (
                  <label key={item} className="flex items-center gap-3 cursor-pointer group">
                    <input 
                      type="checkbox" 
                      checked={selectedFilters.type.includes(item)}
                      onChange={() => toggleFilter('type', item)}
                      className="w-5 h-5 rounded border-charcoal-300 text-charcoal-900 focus:ring-charcoal-900 cursor-pointer transition-colors"
                    />
                    <span className="text-charcoal-700 text-sm font-medium group-hover:text-primary transition-colors">{item}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Filter: Price */}
            <div className="border-b border-charcoal-100 pb-6">
              <h3 className="font-bold text-charcoal-900 mb-4 uppercase text-sm tracking-wide">Khoảng giá</h3>
              <div className="space-y-3">
                {filterOptions.price.map(item => (
                  <label key={item} className="flex items-center gap-3 cursor-pointer group">
                    <input 
                      type="checkbox" 
                      checked={selectedFilters.price.includes(item)}
                      onChange={() => toggleFilter('price', item)}
                      className="w-5 h-5 rounded border-charcoal-300 text-charcoal-900 focus:ring-charcoal-900 cursor-pointer transition-colors"
                    />
                    <span className="text-charcoal-700 text-sm font-medium group-hover:text-primary transition-colors">{item}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Filter: Color */}
            <div className="border-b border-charcoal-100 pb-6">
              <h3 className="font-bold text-charcoal-900 mb-4 uppercase text-sm tracking-wide">Màu sắc</h3>
              <div className="flex flex-wrap gap-3">
                {filterOptions.color.map(c => {
                  const isSelected = selectedFilters.color.includes(c.name);
                  return (
                    <button 
                      key={c.name}
                      onClick={() => toggleFilter('color', c.name)}
                      className={`w-8 h-8 rounded-full border shadow-sm transition-transform ${isSelected ? 'ring-2 ring-primary ring-offset-2 scale-110' : 'border-charcoal-200 hover:scale-110'}`}
                      style={{ backgroundColor: c.hex }}
                      title={c.name}
                    ></button>
                  );
                })}
              </div>
            </div>

            {/* Filter: Size */}
            <div className="border-b border-charcoal-100 pb-6">
              <h3 className="font-bold text-charcoal-900 mb-4 uppercase text-sm tracking-wide">Kích thước</h3>
              <div className="flex flex-wrap gap-2">
                {filterOptions.size.map(item => {
                  const isSelected = selectedFilters.size.includes(item);
                  return (
                    <button 
                      key={item}
                      onClick={() => toggleFilter('size', item)}
                      className={`px-3 py-1.5 border rounded-lg text-sm font-bold transition-colors ${
                        isSelected 
                          ? 'bg-charcoal-900 text-white border-charcoal-900' 
                          : 'bg-white text-charcoal-700 border-charcoal-200 hover:border-charcoal-900'
                      }`}
                    >
                      {item}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Filter: Location */}
            <div>
              <h3 className="font-bold text-charcoal-900 mb-4 uppercase text-sm tracking-wide">Nơi bán</h3>
              <div className="space-y-3">
                {filterOptions.location.map(item => (
                  <label key={item} className="flex items-center gap-3 cursor-pointer group">
                    <input 
                      type="checkbox" 
                      checked={selectedFilters.location.includes(item)}
                      onChange={() => toggleFilter('location', item)}
                      className="w-5 h-5 rounded border-charcoal-300 text-charcoal-900 focus:ring-charcoal-900 cursor-pointer transition-colors"
                    />
                    <span className="text-charcoal-700 text-sm font-medium group-hover:text-primary transition-colors">{item}</span>
                  </label>
                ))}
              </div>
            </div>

          </div>
        </aside>

        {/* RIGHT CONTENT: PRODUCT GRID */}
        <section className="flex-1">
          {/* Toolbar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-8 gap-4 bg-charcoal-50 p-4 rounded-xl border border-charcoal-100">
            <span className="text-charcoal-600 font-medium">Tìm thấy <strong className="text-charcoal-900">{mockProducts.length * 3}</strong> sản phẩm phù hợp.</span>
            
            <div className="flex items-center gap-3">
              <span className="text-sm font-bold text-charcoal-600">Sắp xếp theo:</span>
              <div className="relative">
                <select className="appearance-none pl-4 pr-10 py-2 border border-charcoal-200 bg-white rounded-lg text-sm font-bold text-charcoal-900 focus:outline-none focus:ring-2 focus:ring-primary cursor-pointer shadow-sm">
                  <option>Mới nhất</option>
                  <option>Bán chạy nhất</option>
                  <option>Giá tăng dần</option>
                  <option>Giá giảm dần</option>
                  <option>Đánh giá cao</option>
                </select>
                <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-charcoal-500 pointer-events-none" />
              </div>
            </div>
          </div>

          {/* Grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
            {/* Multiply mock products to simulate a large catalog for visual effect */}
            {[...mockProducts, ...mockProducts, ...mockProducts].map((product, idx) => (
              <ProductCard key={`${product.id}-${idx}`} product={product} />
            ))}
          </div>

          {/* Pagination */}
          <div className="flex justify-center mt-12 gap-2">
            <button className="w-10 h-10 flex items-center justify-center border border-charcoal-200 text-charcoal-600 rounded-lg hover:bg-charcoal-50 transition-colors font-bold">1</button>
            <button className="w-10 h-10 flex items-center justify-center bg-charcoal-900 text-white rounded-lg shadow-md font-bold">2</button>
            <button className="w-10 h-10 flex items-center justify-center border border-charcoal-200 text-charcoal-600 rounded-lg hover:bg-charcoal-50 transition-colors font-bold">3</button>
            <span className="w-10 h-10 flex items-center justify-center text-charcoal-400 font-bold">...</span>
            <button className="w-10 h-10 flex items-center justify-center border border-charcoal-200 text-charcoal-600 rounded-lg hover:bg-charcoal-50 transition-colors font-bold">12</button>
          </div>
        </section>

      </div>
    </div>
  );
};
