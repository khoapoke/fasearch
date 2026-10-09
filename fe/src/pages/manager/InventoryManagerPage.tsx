import React, { useState } from 'react';
import { Search, Filter, PackagePlus, ScanBarcode, Save } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';

export const InventoryManagerPage: React.FC = () => {
  const [isReceiptOpen, setIsReceiptOpen] = useState(false);
  const [isCheckOpen, setIsCheckOpen] = useState(false);

  const mockInventory = [
    { sku: 'SKU-AON-TR-S', name: 'Áo Thun Nam Basic', color: 'Trắng', size: 'S', barcode: '893123456001', stock: 150, reserved: 10 },
    { sku: 'SKU-AON-TR-M', name: 'Áo Thun Nam Basic', color: 'Trắng', size: 'M', barcode: '893123456002', stock: 45, reserved: 5 },
    { sku: 'SKU-AON-DE-L', name: 'Áo Thun Nam Basic', color: 'Đen', size: 'L', barcode: '893123456003', stock: 5, reserved: 2 }, 
    { sku: 'SKU-VAY-HO-M', name: 'Váy Dáng Dài Vintage', color: 'Hồng', size: 'M', barcode: '893123456004', stock: 0, reserved: 0 }, 
  ];

  const handleSave = (e: React.FormEvent, type: 'receipt' | 'check') => {
    e.preventDefault();
    if (type === 'receipt') setIsReceiptOpen(false);
    if (type === 'check') setIsCheckOpen(false);
    alert('Thao tác thành công! Hệ thống đã cập nhật tồn kho.');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <h1 className="text-2xl font-bold text-charcoal-900">Quản lý Kho (SKU)</h1>
        <div className="flex gap-2">
          <button onClick={() => setIsCheckOpen(true)} className="flex items-center gap-2 bg-charcoal-900 text-white px-4 py-2 rounded-base text-sm font-semibold hover:bg-charcoal-800 transition-colors">
            <ScanBarcode size={18} /> Kiểm kê
          </button>
          <button onClick={() => setIsReceiptOpen(true)} className="flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-base text-sm font-semibold hover:bg-primary-hover transition-colors">
            <PackagePlus size={18} /> Lập phiếu nhập kho
          </button>
        </div>
      </div>

      <div className="bg-white border border-charcoal-200 rounded-xl shadow-sm overflow-hidden">
        <div className="p-4 border-b border-charcoal-200 flex flex-col sm:flex-row justify-between items-center bg-charcoal-50 gap-4">
          <div className="relative w-full sm:w-auto">
            <input type="text" placeholder="Tìm Mã SKU, Mã vạch..." className="pl-10 pr-4 py-2 border border-charcoal-200 rounded-base focus:ring-2 focus:ring-primary outline-none text-sm w-full sm:w-72 bg-white" />
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-charcoal-400" size={16} />
          </div>
          <button className="flex items-center gap-2 px-4 py-2 bg-white border border-charcoal-200 rounded-base text-sm font-semibold text-charcoal-700 hover:bg-charcoal-50">
            <Filter size={16} /> Lọc tồn kho thấp
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-white text-charcoal-600 font-semibold border-b border-charcoal-200">
              <tr>
                <th className="px-6 py-4">Mã Biến Thể (SKU)</th>
                <th className="px-6 py-4">Sản Phẩm Gốc</th>
                <th className="px-6 py-4 text-center">Thuộc tính</th>
                <th className="px-6 py-4 text-right">Tồn khả dụng</th>
                <th className="px-6 py-4 text-right">Tạm giữ</th>
                <th className="px-6 py-4 text-center">Cảnh báo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-charcoal-200">
              {mockInventory.map((item) => (
                <tr key={item.sku} className="hover:bg-charcoal-50/50 transition-colors">
                  <td className="px-6 py-4">
                    <p className="font-bold text-charcoal-900">{item.sku}</p>
                    <p className="text-xs text-charcoal-400">Barcode: {item.barcode}</p>
                  </td>
                  <td className="px-6 py-4 font-semibold text-charcoal-700">{item.name}</td>
                  <td className="px-6 py-4 text-center">
                    <span className="inline-block px-2 py-1 bg-charcoal-100 rounded text-xs font-medium mr-1">{item.color}</span>
                    <span className="inline-block px-2 py-1 bg-charcoal-100 rounded text-xs font-medium border border-charcoal-300">{item.size}</span>
                  </td>
                  <td className="px-6 py-4 text-right font-extrabold text-primary text-base">{item.stock}</td>
                  <td className="px-6 py-4 text-right font-medium text-charcoal-500">{item.reserved}</td>
                  <td className="px-6 py-4 text-center">
                    {item.stock === 0 ? <Badge variant="destructive">Hết hàng</Badge> : item.stock < 10 ? <Badge className="bg-yellow-100 text-yellow-800">Sắp hết</Badge> : <Badge className="bg-emerald-100 text-emerald-800">Đủ hàng</Badge>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Lập Phiếu Nhập Kho Modal */}
      <Modal isOpen={isReceiptOpen} onClose={() => setIsReceiptOpen(false)} title="Lập Phiếu Nhập Kho" maxWidth="lg">
        <form onSubmit={(e) => handleSave(e, 'receipt')} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-charcoal-700 mb-1">Nhà cung cấp</label>
              <select className="w-full px-4 py-2 border border-charcoal-200 rounded-base outline-none">
                <option>Xưởng May ABC</option>
                <option>Công ty TNHH Thời Trang</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-charcoal-700 mb-1">Mã hóa đơn chứng từ</label>
              <input type="text" placeholder="VD: HD-00123" className="w-full px-4 py-2 border border-charcoal-200 rounded-base outline-none" required />
            </div>
          </div>
          
          <div className="border border-charcoal-200 rounded-base p-4 bg-charcoal-50 space-y-3">
            <h4 className="text-sm font-bold text-charcoal-900">Chi tiết nhập hàng</h4>
            <div className="flex gap-2 items-center">
              <input type="text" placeholder="Quét Barcode hoặc nhập SKU..." className="flex-1 px-3 py-2 border border-charcoal-200 rounded outline-none" />
              <input type="number" placeholder="SL" className="w-20 px-3 py-2 border border-charcoal-200 rounded outline-none" defaultValue={1} />
              <button type="button" className="px-4 py-2 bg-charcoal-900 text-white rounded font-semibold text-sm">Thêm</button>
            </div>
            {/* Demo items */}
            <div className="bg-white border border-charcoal-200 rounded p-3 text-sm flex justify-between items-center">
              <div>
                <p className="font-bold">SKU-AON-TR-S</p>
                <p className="text-xs text-charcoal-500">Áo Thun Nam Basic (Trắng - S)</p>
              </div>
              <div className="font-bold text-primary">+ 50 cái</div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-charcoal-700 mb-1">Ghi chú phiếu nhập</label>
            <textarea className="w-full px-4 py-2 border border-charcoal-200 rounded-base outline-none h-20 resize-none"></textarea>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-charcoal-200">
            <button type="button" onClick={() => setIsReceiptOpen(false)} className="px-4 py-2 border border-charcoal-200 text-charcoal-700 font-semibold rounded-base hover:bg-charcoal-50">Hủy</button>
            <button type="submit" className="px-6 py-2 bg-primary text-white font-semibold rounded-base hover:bg-primary-hover flex items-center gap-2"><Save size={18}/> Tạo phiếu nhập</button>
          </div>
        </form>
      </Modal>

      {/* Kiểm kê Modal */}
      <Modal isOpen={isCheckOpen} onClose={() => setIsCheckOpen(false)} title="Kiểm kê Kho" maxWidth="lg">
        <form onSubmit={(e) => handleSave(e, 'check')} className="space-y-4">
          <div className="bg-blue-50 text-blue-700 p-3 rounded-base text-sm font-medium mb-4 flex gap-2">
            <ScanBarcode size={20} />
            Hệ thống đang ở chế độ kiểm kê. Vui lòng sử dụng máy quét mã vạch (Barcode Scanner) để đếm số lượng thực tế.
          </div>
          
          <div className="relative">
            <input type="text" autoFocus placeholder="Scan mã vạch tại đây..." className="w-full pl-10 pr-4 py-3 border-2 border-primary rounded-xl focus:outline-none focus:ring-4 focus:ring-primary/20 text-lg font-bold" />
            <ScanBarcode className="absolute left-3 top-1/2 -translate-y-1/2 text-primary" size={24} />
          </div>

          <div className="mt-4 border border-charcoal-200 rounded-base overflow-hidden">
            <table className="w-full text-sm text-left">
              <thead className="bg-charcoal-50 text-charcoal-600 font-semibold">
                <tr>
                  <th className="px-4 py-2">Mã SKU</th>
                  <th className="px-4 py-2 text-center">Tồn HT</th>
                  <th className="px-4 py-2 text-center">Kiểm đếm</th>
                  <th className="px-4 py-2 text-center">Lệch</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-charcoal-100">
                <tr>
                  <td className="px-4 py-3 font-bold text-charcoal-900">SKU-AON-TR-M</td>
                  <td className="px-4 py-3 text-center">45</td>
                  <td className="px-4 py-3 text-center font-bold text-primary">45</td>
                  <td className="px-4 py-3 text-center text-emerald-600 font-bold">0</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-bold text-charcoal-900">SKU-VAY-HO-M</td>
                  <td className="px-4 py-3 text-center">0</td>
                  <td className="px-4 py-3 text-center font-bold text-primary">1</td>
                  <td className="px-4 py-3 text-center text-yellow-600 font-bold">+1</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button type="button" onClick={() => setIsCheckOpen(false)} className="px-4 py-2 border border-charcoal-200 text-charcoal-700 font-semibold rounded-base hover:bg-charcoal-50">Tạm dừng</button>
            <button type="submit" className="px-6 py-2 bg-charcoal-900 text-white font-semibold rounded-base hover:bg-charcoal-800 flex items-center gap-2">Chốt kiểm kê & Cân bằng</button>
          </div>
        </form>
      </Modal>

    </div>
  );
};
