import React, { useState } from 'react';
import { Search, Plus, Edit2, Trash2, FolderTree, Save } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';

export const CategoryManagerPage: React.FC = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'add' | 'edit'>('add');

  const mockCategories = [
    { id: 'DM01', name: 'Áo Nam', status: 'ACTIVE', productCount: 124 },
    { id: 'DM02', name: 'Quần Nam', status: 'ACTIVE', productCount: 85 },
    { id: 'DM03', name: 'Váy Nữ', status: 'ACTIVE', productCount: 210 },
    { id: 'DM04', name: 'Phụ kiện', status: 'INACTIVE', productCount: 0 },
  ];

  const handleOpenModal = (mode: 'add' | 'edit') => {
    setModalMode(mode);
    setIsModalOpen(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setIsModalOpen(false);
    alert(modalMode === 'add' ? 'Thêm mới thành công!' : 'Lưu chỉnh sửa thành công!');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <h1 className="text-2xl font-bold text-charcoal-900 flex items-center gap-2">
          <FolderTree className="text-primary" /> Quản lý Danh mục
        </h1>
        <button onClick={() => handleOpenModal('add')} className="flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-base text-sm font-semibold hover:bg-primary-hover transition-colors">
          <Plus size={18} /> Thêm danh mục
        </button>
      </div>

      <div className="bg-white border border-charcoal-200 rounded-xl shadow-sm overflow-hidden">
        <div className="p-4 border-b border-charcoal-200 flex justify-between items-center bg-charcoal-50">
          <div className="relative">
            <input type="text" placeholder="Tìm kiếm danh mục..." className="pl-10 pr-4 py-2 border border-charcoal-200 rounded-base focus:ring-2 focus:ring-primary outline-none text-sm w-64 bg-white" />
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-charcoal-400" size={16} />
          </div>
        </div>

        <table className="w-full text-sm text-left">
          <thead className="bg-white text-charcoal-600 font-semibold border-b border-charcoal-200">
            <tr>
              <th className="px-6 py-4">Mã Danh Mục</th>
              <th className="px-6 py-4">Tên Danh Mục</th>
              <th className="px-6 py-4 text-center">Số Sản Phẩm</th>
              <th className="px-6 py-4">Trạng Thái</th>
              <th className="px-6 py-4 text-center">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-charcoal-200">
            {mockCategories.map((cat) => (
              <tr key={cat.id} className="hover:bg-charcoal-50/50 transition-colors">
                <td className="px-6 py-4 font-bold text-charcoal-900">{cat.id}</td>
                <td className="px-6 py-4 font-semibold text-charcoal-700">{cat.name}</td>
                <td className="px-6 py-4 text-center font-medium text-primary">{cat.productCount}</td>
                <td className="px-6 py-4">
                  {cat.status === 'ACTIVE' ? <Badge className="bg-emerald-100 text-emerald-800">Hoạt động</Badge> : <Badge variant="outline">Tạm ẩn</Badge>}
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

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={modalMode === 'add' ? "Thêm danh mục mới" : "Chỉnh sửa danh mục"} maxWidth="md">
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-charcoal-700 mb-1">Mã danh mục</label>
            <input type="text" defaultValue={modalMode === 'add' ? 'DM05' : 'DM01'} disabled={modalMode === 'edit'} className="w-full px-4 py-2 border border-charcoal-200 rounded-base bg-charcoal-50 outline-none" required />
          </div>
          <div>
            <label className="block text-sm font-semibold text-charcoal-700 mb-1">Tên danh mục</label>
            <input type="text" defaultValue={modalMode === 'edit' ? 'Áo Nam' : ''} placeholder="VD: Quần áo mùa đông..." className="w-full px-4 py-2 border border-charcoal-200 rounded-base focus:ring-2 focus:ring-primary outline-none" required />
          </div>
          <div>
            <label className="block text-sm font-semibold text-charcoal-700 mb-1">Trạng thái</label>
            <select className="w-full px-4 py-2 border border-charcoal-200 rounded-base focus:ring-2 focus:ring-primary outline-none">
              <option value="ACTIVE">Hoạt động (Hiển thị)</option>
              <option value="INACTIVE">Tạm ẩn</option>
            </select>
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 border border-charcoal-200 text-charcoal-700 font-semibold rounded-base hover:bg-charcoal-50">Hủy</button>
            <button type="submit" className="px-6 py-2 bg-primary text-white font-semibold rounded-base hover:bg-primary-hover flex items-center gap-2"><Save size={18}/> Lưu</button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
