import React, { useState } from 'react';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Plus, Ticket, Search, Edit, Trash2, Save } from 'lucide-react';

export const VoucherManagerPage: React.FC = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'add' | 'edit'>('add');

  const mockVouchers = [
    { code: 'SUMMER50', desc: 'Giảm 50% tối đa 100k', type: 'Phần trăm', status: 'ACTIVE', usage: '145/500', exp: '2026-11-01' },
    { code: 'FREESHIP', desc: 'Miễn phí vận chuyển toàn quốc', type: 'Vận chuyển', status: 'ACTIVE', usage: '990/1000', exp: '2026-12-31' },
    { code: 'NEWUSER20', desc: 'Giảm 20% cho user mới', type: 'Phần trăm', status: 'INACTIVE', usage: '500/500', exp: '2026-10-01' },
  ];

  const handleOpenModal = (mode: 'add' | 'edit') => {
    setModalMode(mode);
    setIsModalOpen(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setIsModalOpen(false);
    alert(modalMode === 'add' ? 'Đã tạo Voucher thành công!' : 'Đã lưu chỉnh sửa Voucher!');
  };

  return (
    <div className="space-y-6">
      {/* Top Actions */}
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div className="flex items-center gap-2">
          <div className="relative">
            <input type="text" placeholder="Tìm mã voucher..." className="pl-10 pr-4 py-2 border border-charcoal-200 rounded-base focus:ring-2 focus:ring-primary outline-none text-sm w-64" />
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-charcoal-400" size={16} />
          </div>
        </div>
        <button onClick={() => handleOpenModal('add')} className="flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-base text-sm font-semibold hover:bg-primary-hover transition-colors">
          <Plus size={18} /> Tạo Voucher mới
        </button>
      </div>

      {/* Grid of Vouchers */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {mockVouchers.map(v => (
          <div key={v.code} className="bg-white border border-charcoal-200 rounded-xl p-5 shadow-sm relative overflow-hidden group hover:border-primary transition-colors flex flex-col">
            <div className="absolute top-0 right-0 w-24 h-24 bg-primary/5 rounded-full -translate-y-1/2 translate-x-1/2"></div>
            
            <div className="flex justify-between items-start mb-4 relative z-10">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-primary-light text-primary rounded-lg">
                  <Ticket size={24} />
                </div>
                <div>
                  <h3 className="font-extrabold text-charcoal-900 text-lg tracking-wider">{v.code}</h3>
                  <span className="text-xs text-charcoal-500">{v.type}</span>
                </div>
              </div>
              {v.status === 'ACTIVE' ? <Badge className="bg-emerald-100 text-emerald-800">Đang chạy</Badge> : <Badge className="bg-charcoal-100 text-charcoal-500">Đã kết thúc</Badge>}
            </div>

            <p className="text-sm font-medium text-charcoal-700 mb-4">{v.desc}</p>
            
            <div className="flex items-center justify-between text-xs text-charcoal-500 border-t border-charcoal-100 pt-4 mt-auto">
              <span>Đã dùng: <strong className="text-charcoal-900">{v.usage}</strong></span>
              <span>HSD: <strong className="text-crimson">{v.exp}</strong></span>
            </div>

            {/* Hover Actions */}
            <div className="absolute inset-x-0 bottom-0 p-3 bg-white/90 backdrop-blur border-t border-charcoal-200 translate-y-full group-hover:translate-y-0 transition-transform flex gap-2">
               <button onClick={() => handleOpenModal('edit')} className="flex-1 py-1.5 text-xs font-bold text-primary bg-primary-light rounded hover:bg-primary hover:text-white transition-colors flex justify-center items-center gap-1"><Edit size={14}/> Sửa</button>
               <button className="flex-1 py-1.5 text-xs font-bold text-crimson bg-crimson-light rounded hover:bg-crimson hover:text-white transition-colors flex justify-center items-center gap-1"><Trash2 size={14}/> Xóa</button>
            </div>
          </div>
        ))}
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={modalMode === 'add' ? "Tạo Voucher mới" : "Chỉnh sửa Voucher"} maxWidth="md">
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-charcoal-700 mb-1">Mã Voucher (Code)</label>
            <input type="text" defaultValue={modalMode === 'edit' ? 'SUMMER50' : ''} placeholder="VD: SIEUSALE, FREESHIP..." className="w-full px-4 py-2 border border-charcoal-200 rounded-base focus:ring-2 focus:ring-primary outline-none uppercase font-bold" required />
          </div>
          <div>
            <label className="block text-sm font-semibold text-charcoal-700 mb-1">Mô tả chương trình</label>
            <input type="text" defaultValue={modalMode === 'edit' ? 'Giảm 50% tối đa 100k' : ''} className="w-full px-4 py-2 border border-charcoal-200 rounded-base focus:ring-2 focus:ring-primary outline-none" required />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-charcoal-700 mb-1">Loại giảm giá</label>
              <select className="w-full px-4 py-2 border border-charcoal-200 rounded-base outline-none">
                <option>Giảm theo phần trăm (%)</option>
                <option>Giảm tiền trực tiếp (VNĐ)</option>
                <option>Miễn phí vận chuyển</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-charcoal-700 mb-1">Giá trị giảm</label>
              <input type="number" defaultValue={modalMode === 'edit' ? 50 : 0} className="w-full px-4 py-2 border border-charcoal-200 rounded-base outline-none" required />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-charcoal-700 mb-1">Tổng số lượng mã</label>
              <input type="number" defaultValue={modalMode === 'edit' ? 500 : 100} className="w-full px-4 py-2 border border-charcoal-200 rounded-base outline-none" required />
            </div>
            <div>
              <label className="block text-sm font-semibold text-charcoal-700 mb-1">Hạn sử dụng</label>
              <input type="date" defaultValue={modalMode === 'edit' ? '2026-11-01' : ''} className="w-full px-4 py-2 border border-charcoal-200 rounded-base outline-none" required />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-charcoal-200">
            <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 border border-charcoal-200 text-charcoal-700 font-semibold rounded-base hover:bg-charcoal-50">Hủy</button>
            <button type="submit" className="px-6 py-2 bg-primary text-white font-semibold rounded-base hover:bg-primary-hover flex items-center gap-2"><Save size={18}/> {modalMode === 'add' ? 'Tạo mới' : 'Lưu'}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
