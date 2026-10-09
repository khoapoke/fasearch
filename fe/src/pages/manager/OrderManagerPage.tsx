import React from 'react';
import { mockOrders } from '@/features/orders/mocks/orders.mock';
import { OrderStatus } from '@/features/orders/types';
import { formatVND } from '@/utils/format';
import { Badge } from '@/components/ui/Badge';
import { Search, Filter, Eye, CheckCircle2, Download } from 'lucide-react';

export const OrderManagerPage: React.FC = () => {

  const getStatusBadge = (status: OrderStatus) => {
    switch (status) {
      case 'PENDING': return <Badge className="bg-yellow-100/80 text-yellow-800 hover:bg-yellow-200 border-yellow-200 shadow-sm">Chờ xử lý</Badge>;
      case 'PROCESSING': return <Badge className="bg-blue-100/80 text-blue-800 hover:bg-blue-200 border-blue-200 shadow-sm">Đang chuẩn bị</Badge>;
      case 'SHIPPING': return <Badge className="bg-indigo-100/80 text-indigo-800 hover:bg-indigo-200 border-indigo-200 shadow-sm">Đang giao hàng</Badge>;
      case 'COMPLETED': return <Badge className="bg-emerald-100/80 text-emerald-800 hover:bg-emerald-200 border-emerald-200 shadow-sm">Hoàn thành</Badge>;
      case 'CANCELLED': return <Badge variant="destructive" className="shadow-sm">Đã hủy</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Top Actions */}
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="relative group w-full sm:w-72">
            <input 
              type="text" 
              placeholder="Tìm mã đơn hàng, SĐT..." 
              className="w-full pl-11 pr-4 py-2.5 border border-charcoal-200 rounded-xl focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none text-sm transition-all shadow-sm group-hover:shadow"
            />
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-charcoal-400 group-hover:text-primary transition-colors" size={18} />
          </div>
          <button className="flex items-center justify-center gap-2 px-4 py-2.5 bg-white border border-charcoal-200 rounded-xl text-sm font-bold text-charcoal-700 hover:bg-charcoal-50 hover:text-primary hover:border-primary/30 transition-all shadow-sm hover:shadow">
            <Filter size={18} /> Lọc
          </button>
        </div>
        <button className="flex items-center justify-center gap-2 bg-gradient-to-r from-charcoal-800 to-charcoal-900 text-white px-5 py-2.5 rounded-xl text-sm font-bold shadow-md hover:shadow-lg hover:-translate-y-0.5 active:scale-95 transition-all">
          <Download size={18} /> Xuất Excel
        </button>
      </div>

      {/* Table */}
      <div className="bg-white border border-charcoal-100 rounded-2xl shadow-md overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-charcoal-50/50 text-charcoal-500 font-bold uppercase tracking-wider text-xs border-b border-charcoal-100">
              <tr>
                <th className="px-6 py-5">Mã đơn hàng</th>
                <th className="px-6 py-5">Khách hàng</th>
                <th className="px-6 py-5">Ngày đặt</th>
                <th className="px-6 py-5">Tổng tiền</th>
                <th className="px-6 py-5">Thanh toán</th>
                <th className="px-6 py-5">Trạng thái</th>
                <th className="px-6 py-5 text-center">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-charcoal-50">
              {mockOrders.map((order, idx) => (
                <tr 
                  key={order.id} 
                  className="hover:bg-primary/5 transition-colors group cursor-default animate-in fade-in fill-mode-both"
                  style={{ animationDelay: `${idx * 100}ms` }}
                >
                  <td className="px-6 py-4">
                    <span className="font-bold text-charcoal-900 group-hover:text-primary transition-colors">{order.id}</span>
                  </td>
                  <td className="px-6 py-4">
                    <p className="font-bold text-charcoal-900">{order.customerName}</p>
                    <p className="text-xs text-charcoal-500 font-medium">{order.customerPhone}</p>
                  </td>
                  <td className="px-6 py-4 text-charcoal-600 font-medium">
                    {new Date(order.date).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' })}
                  </td>
                  <td className="px-6 py-4">
                    <span className="font-black text-primary block">{formatVND(order.total)}</span>
                    <span className="text-xs text-charcoal-500 font-medium">{order.itemsCount} sản phẩm</span>
                  </td>
                  <td className="px-6 py-4 text-charcoal-600 font-medium">
                    <span className="bg-charcoal-100/50 px-2.5 py-1 rounded-md text-xs font-bold border border-charcoal-200">{order.paymentMethod}</span>
                  </td>
                  <td className="px-6 py-4">
                    {getStatusBadge(order.status)}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-center gap-2 opacity-60 group-hover:opacity-100 transition-opacity">
                      <button className="p-2 bg-white text-charcoal-400 hover:text-primary hover:bg-primary-light rounded-lg transition-all shadow-sm border border-charcoal-100 hover:border-primary/30" title="Xem chi tiết">
                        <Eye size={18} />
                      </button>
                      <button className="p-2 bg-white text-charcoal-400 hover:text-emerald-600 hover:bg-emerald-100 rounded-lg transition-all shadow-sm border border-charcoal-100 hover:border-emerald-200" title="Cập nhật trạng thái">
                        <CheckCircle2 size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        {/* Pagination placeholder */}
        <div className="p-5 border-t border-charcoal-100 bg-charcoal-50/30 flex items-center justify-between text-sm text-charcoal-500 font-medium">
          <span>Hiển thị <strong className="text-charcoal-900">1 - 5</strong> của <strong className="text-charcoal-900">120</strong> đơn hàng</span>
          <div className="flex gap-1.5">
            <button className="px-3.5 py-1.5 border border-charcoal-200 bg-white rounded-lg hover:bg-charcoal-50 hover:text-charcoal-900 transition-colors shadow-sm">Trước</button>
            <button className="px-3.5 py-1.5 bg-gradient-to-r from-primary to-orange-500 text-white font-bold rounded-lg shadow-md">1</button>
            <button className="px-3.5 py-1.5 border border-charcoal-200 bg-white rounded-lg hover:bg-charcoal-50 hover:text-charcoal-900 transition-colors shadow-sm">2</button>
            <button className="px-3.5 py-1.5 border border-charcoal-200 bg-white rounded-lg hover:bg-charcoal-50 hover:text-charcoal-900 transition-colors shadow-sm">Sau</button>
          </div>
        </div>
      </div>
    </div>
  );
};
