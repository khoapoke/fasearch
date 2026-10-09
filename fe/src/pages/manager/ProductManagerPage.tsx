import React, { useState } from 'react';
import { mockProducts } from '@/features/products/mocks/products.mock';
import { formatVND } from '@/utils/format';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Search, Filter, Plus, Edit2, Trash2, Save, UploadCloud } from 'lucide-react';

export const ProductManagerPage: React.FC = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'add' | 'edit'>('add');

  const handleOpenModal = (mode: 'add' | 'edit') => {
    setModalMode(mode);
    setIsModalOpen(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setIsModalOpen(false);
    alert('Lưu sản phẩm thành công!');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div className="flex items-center gap-2">
          <div className="relative">
            <input type="text" placeholder="Tìm tên, mã sản phẩm..." className="pl-10 pr-4 py-2 border border-charcoal-200 rounded-base focus:ring-2 focus:ring-primary outline-none text-sm w-64" />
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-charcoal-400" size={16} />
          </div>
          <button className="flex items-center gap-2 px-4 py-2 bg-white border border-charcoal-200 rounded-base text-sm font-semibold text-charcoal-700 hover:bg-charcoal-50">
            <Filter size={16} /> Danh mục
          </button>
        </div>
        <button onClick={() => handleOpenModal('add')} className="flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-base text-sm font-semibold hover:bg-primary-hover transition-colors">
          <Plus size={18} /> Thêm sản phẩm
        </button>
      </div>

      <div className="bg-white border border-charcoal-200 rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-charcoal-50 text-charcoal-600 font-semibold border-b border-charcoal-200">
              <tr>
                <th className="px-6 py-4">Sản phẩm</th>
                <th className="px-6 py-4">Danh mục</th>
                <th className="px-6 py-4">Giá bán</th>
                <th className="px-6 py-4">Tồn kho</th>
                <th className="px-6 py-4">Trạng thái</th>
                <th className="px-6 py-4 text-center">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-charcoal-200">
              {mockProducts.map((product) => (
                <tr key={product.id} className="hover:bg-charcoal-50/50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-4">
                      <img src={product.imageUrl} className="w-12 h-16 object-cover rounded-md border border-charcoal-200" alt="" />
                      <div>
                        <p className="font-semibold text-charcoal-900 line-clamp-1">{product.name}</p>
                        <p className="text-xs text-charcoal-400 mt-1">ID: {product.id}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-charcoal-600">{product.category}</td>
                  <td className="px-6 py-4">
                    <span className="font-bold text-charcoal-900">{formatVND(product.price)}</span>
                    {product.originalPrice && <span className="block text-xs text-charcoal-400 line-through mt-0.5">{formatVND(product.originalPrice)}</span>}
                  </td>
                  <td className="px-6 py-4 text-charcoal-600">
                    {product.inStock ? <span className="text-charcoal-900 font-semibold">150</span> : <span className="text-crimson font-semibold">0</span>}
                  </td>
                  <td className="px-6 py-4">
                    {product.inStock ? <Badge className="bg-emerald-100 text-emerald-800">Đang bán</Badge> : <Badge className="bg-charcoal-100 text-charcoal-500">Hết hàng</Badge>}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-center gap-2">
                      <button onClick={() => handleOpenModal('edit')} className="p-1.5 text-charcoal-400 hover:text-primary hover:bg-primary-light rounded-md transition-colors" title="Chỉnh sửa">
                        <Edit2 size={18} />
                      </button>
                      <button className="p-1.5 text-charcoal-400 hover:text-crimson hover:bg-crimson-light rounded-md transition-colors" title="Xóa">
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={modalMode === 'add' ? "Thêm sản phẩm mới" : "Chỉnh sửa sản phẩm"} maxWidth="2xl">
        <form onSubmit={handleSave} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-charcoal-700 mb-1">Tên sản phẩm</label>
                <input type="text" className="w-full px-4 py-2 border border-charcoal-200 rounded-base focus:ring-2 focus:ring-primary outline-none" required />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-charcoal-700 mb-1">Mã SP</label>
                  <input type="text" className="w-full px-4 py-2 border border-charcoal-200 rounded-base outline-none" required />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-charcoal-700 mb-1">Danh mục</label>
                  <select className="w-full px-4 py-2 border border-charcoal-200 rounded-base outline-none">
                    <option>Áo Nam</option>
                    <option>Quần Nam</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-charcoal-700 mb-1">Giá nhập</label>
                  <input type="number" className="w-full px-4 py-2 border border-charcoal-200 rounded-base outline-none" required />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-charcoal-700 mb-1">Giá bán</label>
                  <input type="number" className="w-full px-4 py-2 border border-charcoal-200 rounded-base outline-none" required />
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-charcoal-700 mb-1">Mô tả sản phẩm</label>
                <textarea className="w-full px-4 py-2 border border-charcoal-200 rounded-base outline-none h-24 resize-none"></textarea>
              </div>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-charcoal-700 mb-1">Hình ảnh đại diện</label>
                <div className="border-2 border-dashed border-charcoal-300 rounded-xl h-32 flex flex-col items-center justify-center text-charcoal-400 bg-charcoal-50 cursor-pointer hover:bg-charcoal-100 transition-colors">
                  <UploadCloud size={24} className="mb-2" />
                  <span className="text-sm font-medium">Tải ảnh lên (Max 5MB)</span>
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-charcoal-700 mb-1">Phân loại / Biến thể (Màu, Size)</label>
                <div className="border border-charcoal-200 rounded-base p-4 bg-charcoal-50 space-y-3">
                  <input type="text" placeholder="Nhập các màu (cách nhau bởi phẩy)..." className="w-full px-3 py-1.5 border border-charcoal-200 rounded text-sm outline-none" />
                  <input type="text" placeholder="Nhập các size (cách nhau bởi phẩy)..." className="w-full px-3 py-1.5 border border-charcoal-200 rounded text-sm outline-none" />
                  <p className="text-xs text-charcoal-500 italic">Hệ thống sẽ tự động sinh mã SKU dựa trên các biến thể này.</p>
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-charcoal-200">
            <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 border border-charcoal-200 text-charcoal-700 font-semibold rounded-base hover:bg-charcoal-50">Hủy</button>
            <button type="submit" className="px-6 py-2 bg-primary text-white font-semibold rounded-base hover:bg-primary-hover flex items-center gap-2"><Save size={18}/> Lưu</button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
