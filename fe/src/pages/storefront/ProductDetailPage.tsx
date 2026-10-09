import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Product } from '@/features/products/types';
import { mockProducts } from '@/features/products/mocks/products.mock';
import { useCart } from '@/features/cart/context/CartContext';
import { formatVND } from '@/utils/format';
import { Star, ShoppingCart, ArrowLeft, Heart, ShieldCheck, Truck } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';

export const ProductDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { addToCart } = useCart();
  
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  
  const [selectedSize, setSelectedSize] = useState<string>('');
  const [selectedColor, setSelectedColor] = useState<string>('');
  const [quantity, setQuantity] = useState(1);
  const [activeImage, setActiveImage] = useState<string>('');

  useEffect(() => {
    // Fake API call
    setLoading(true);
    setTimeout(() => {
      const found = mockProducts.find(p => p.id === id);
      if (found) {
        setProduct(found);
        setActiveImage(found.imageUrl);
        if (found.sizes?.length) setSelectedSize(found.sizes[0]);
        if (found.colors?.length) setSelectedColor(found.colors[0].name);
      }
      setLoading(false);
    }, 400);
  }, [id]);

  if (loading) return <div className="min-h-[60vh] flex items-center justify-center">Đang tải sản phẩm...</div>;
  if (!product) return <div className="min-h-[60vh] flex items-center justify-center flex-col gap-4">
    <p>Không tìm thấy sản phẩm</p>
    <button onClick={() => navigate('/')} className="text-primary hover:underline">Quay về trang chủ</button>
  </div>;

  const handleAddToCart = () => {
    addToCart(product, quantity, selectedSize, selectedColor);
    // Optional: show toast or open mini cart
    alert('Đã thêm vào giỏ hàng!');
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-charcoal-500 hover:text-primary mb-6 transition-colors">
        <ArrowLeft size={20} /> Quay lại
      </button>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
        {/* Left: Image Gallery */}
        <div className="flex flex-col gap-4">
          <div className="aspect-[3/4] bg-charcoal-100 rounded-xl overflow-hidden border border-charcoal-200">
            <img src={activeImage} alt={product.name} className="w-full h-full object-cover" />
          </div>
          {product.images && product.images.length > 0 && (
            <div className="flex gap-4 overflow-x-auto pb-2">
              <button 
                onClick={() => setActiveImage(product.imageUrl)}
                className={`w-20 h-24 rounded-lg overflow-hidden border-2 flex-shrink-0 ${activeImage === product.imageUrl ? 'border-primary' : 'border-transparent'}`}
              >
                <img src={product.imageUrl} className="w-full h-full object-cover" />
              </button>
              {product.images.map((img, idx) => (
                <button 
                  key={idx} 
                  onClick={() => setActiveImage(img)}
                  className={`w-20 h-24 rounded-lg overflow-hidden border-2 flex-shrink-0 ${activeImage === img ? 'border-primary' : 'border-transparent'}`}
                >
                  <img src={img} className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Right: Product Info */}
        <div className="flex flex-col">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-sm font-semibold text-charcoal-500 uppercase">{product.category}</span>
            {product.isNew && <Badge variant="ai">Mới</Badge>}
            {product.discountPercent && <Badge variant="destructive">-{product.discountPercent}%</Badge>}
          </div>
          
          <h1 className="text-3xl font-extrabold text-charcoal-900 mb-4 leading-tight">{product.name}</h1>
          
          <div className="flex items-center gap-4 mb-6">
            <div className="flex items-center gap-1 text-yellow-400">
              <Star size={18} className="fill-current" />
              <span className="font-bold text-charcoal-700 ml-1">{product.rating}</span>
            </div>
            <span className="text-charcoal-300">|</span>
            <span className="text-charcoal-500 text-sm">Đã bán {product.reviewsCount * 3}+</span>
          </div>

          <div className="flex items-end gap-3 mb-8">
            <span className="text-4xl font-extrabold text-primary">{formatVND(product.price)}</span>
            {product.originalPrice && (
              <span className="text-xl text-charcoal-400 line-through mb-1">{formatVND(product.originalPrice)}</span>
            )}
          </div>

          {/* Color Selection */}
          {product.colors && (
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-charcoal-900 mb-3">Màu sắc: <span className="font-normal">{selectedColor}</span></h3>
              <div className="flex items-center gap-3">
                {product.colors.map(color => (
                  <button
                    key={color.name}
                    onClick={() => setSelectedColor(color.name)}
                    className={`w-8 h-8 rounded-full border-2 focus:outline-none transition-all ${selectedColor === color.name ? 'border-primary scale-110 shadow-md' : 'border-charcoal-200 hover:scale-110'}`}
                    style={{ backgroundColor: color.hex }}
                    title={color.name}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Size Selection */}
          {product.sizes && (
            <div className="mb-8">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-charcoal-900">Kích cỡ</h3>
                <button className="text-sm text-primary hover:underline">Hướng dẫn chọn size</button>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                {product.sizes.map(size => (
                  <button
                    key={size}
                    onClick={() => setSelectedSize(size)}
                    className={`min-w-[3rem] px-3 py-2 rounded-base font-semibold border focus:outline-none transition-all ${
                      selectedSize === size 
                        ? 'bg-charcoal-900 text-white border-charcoal-900' 
                        : 'bg-white text-charcoal-700 border-charcoal-200 hover:border-charcoal-400'
                    }`}
                  >
                    {size}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Quantity & Actions */}
          <div className="flex items-center gap-4 mb-8">
            <div className="flex items-center border border-charcoal-200 rounded-base overflow-hidden h-12">
              <button onClick={() => setQuantity(Math.max(1, quantity - 1))} className="px-4 text-charcoal-600 hover:bg-charcoal-100 h-full font-bold transition-colors">-</button>
              <div className="w-12 text-center font-semibold text-charcoal-900">{quantity}</div>
              <button onClick={() => setQuantity(quantity + 1)} className="px-4 text-charcoal-600 hover:bg-charcoal-100 h-full font-bold transition-colors">+</button>
            </div>
            
            <button 
              onClick={handleAddToCart}
              disabled={!product.inStock}
              className="flex-1 h-12 flex items-center justify-center gap-2 bg-primary text-white rounded-base font-bold hover:bg-primary-hover transition-colors disabled:bg-charcoal-300 disabled:cursor-not-allowed"
            >
              <ShoppingCart size={20} />
              {product.inStock ? 'THÊM VÀO GIỎ' : 'TẠM HẾT HÀNG'}
            </button>

            <button className="h-12 w-12 flex items-center justify-center border border-charcoal-200 rounded-base text-charcoal-500 hover:text-crimson hover:border-crimson hover:bg-crimson-light transition-all">
              <Heart size={20} />
            </button>
          </div>

          {/* Description & Perks */}
          <div className="pt-6 border-t border-charcoal-200">
            <h3 className="font-bold text-charcoal-900 mb-2">Mô tả sản phẩm</h3>
            <p className="text-charcoal-600 leading-relaxed mb-6">
              {product.description || 'Sản phẩm đang được cập nhật mô tả chi tiết.'}
            </p>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center gap-3 p-3 bg-charcoal-50 rounded-lg">
                <ShieldCheck className="text-primary" size={24} />
                <div className="text-sm">
                  <p className="font-semibold text-charcoal-900">Cam kết chính hãng</p>
                  <p className="text-charcoal-500 text-xs">Hoàn tiền 200%</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 bg-charcoal-50 rounded-lg">
                <Truck className="text-primary" size={24} />
                <div className="text-sm">
                  <p className="font-semibold text-charcoal-900">Giao hàng Hỏa Tốc</p>
                  <p className="text-charcoal-500 text-xs">Nhận trong 2 giờ</p>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};
