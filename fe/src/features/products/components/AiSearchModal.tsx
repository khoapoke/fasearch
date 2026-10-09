import React, { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Search, Upload, Camera, Loader2, Sparkles } from 'lucide-react';

export const AiSearchModal: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
  const [isSearching, setIsSearching] = useState(false);
  const [query, setQuery] = useState('');

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query) return;
    setIsSearching(true);
    setTimeout(() => {
      setIsSearching(false);
      onClose();
      // Normally navigate to search results
      alert(`Đã tìm kiếm: ${query}`);
    }, 1500);
  };

  return (
    <Modal isOpen={isOpen} onClose={() => !isSearching && onClose()} title="Tìm kiếm thông minh AI" maxWidth="lg">
      <div className="space-y-6">
        <div className="p-4 bg-primary/5 border border-primary/20 rounded-xl flex items-start gap-3">
          <Sparkles className="text-primary mt-0.5" size={20} />
          <div>
            <h4 className="font-bold text-charcoal-900 text-sm mb-1">AI Fashion Search</h4>
            <p className="text-charcoal-600 text-xs">
              Mô tả phong cách bạn muốn hoặc tải lên một bức ảnh. AI của chúng tôi sẽ tìm các sản phẩm tương tự trong cửa hàng.
            </p>
          </div>
        </div>

        <form onSubmit={handleSearch} className="relative">
          <input 
            type="text" 
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="VD: Áo sơ mi nam đi biển màu xanh pastel..." 
            className="w-full pl-12 pr-4 py-3 bg-white border border-charcoal-200 rounded-xl focus:ring-2 focus:ring-primary outline-none transition-shadow text-charcoal-900 font-medium"
            disabled={isSearching}
          />
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-charcoal-400" size={20} />
        </form>

        <div className="relative flex py-2 items-center">
          <div className="flex-grow border-t border-charcoal-100"></div>
          <span className="flex-shrink-0 mx-4 text-charcoal-400 text-xs font-bold uppercase">Hoặc</span>
          <div className="flex-grow border-t border-charcoal-100"></div>
        </div>

        <div className="border-2 border-dashed border-charcoal-200 bg-charcoal-50 hover:bg-primary/5 hover:border-primary/30 rounded-2xl p-8 flex flex-col items-center justify-center transition-colors cursor-pointer group">
          <div className="flex gap-4 mb-3">
            <div className="w-12 h-12 bg-white rounded-full shadow-sm flex items-center justify-center text-charcoal-500 group-hover:text-primary transition-colors">
              <Upload size={20} />
            </div>
            <div className="w-12 h-12 bg-white rounded-full shadow-sm flex items-center justify-center text-charcoal-500 group-hover:text-primary transition-colors">
              <Camera size={20} />
            </div>
          </div>
          <p className="text-sm font-bold text-charcoal-700 group-hover:text-primary">Tải ảnh lên hoặc chụp ảnh mới</p>
          <p className="text-xs text-charcoal-400 mt-1">PNG, JPG (Tối đa 5MB)</p>
        </div>

        <div className="flex justify-end pt-2">
          <button 
            onClick={handleSearch}
            disabled={isSearching || (!query)}
            className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-primary to-orange-500 text-white font-bold rounded-xl hover:shadow-lg disabled:opacity-50 transition-all"
          >
            {isSearching ? <Loader2 size={18} className="animate-spin" /> : <Search size={18} />}
            {isSearching ? 'AI Đang phân tích...' : 'Tìm kiếm'}
          </button>
        </div>
      </div>
    </Modal>
  );
};
