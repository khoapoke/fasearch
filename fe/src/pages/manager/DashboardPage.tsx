import React from 'react';
import { TrendingUp, Package, Users, DollarSign } from 'lucide-react';
import { formatVND } from '@/utils/format';

export const DashboardPage: React.FC = () => {
  const stats = [
    { title: 'Tổng Doanh Thu', value: formatVND(125000000), icon: DollarSign, color: 'text-primary' },
    { title: 'Đơn Hàng Mới', value: '142', icon: Package, color: 'text-blue-500' },
    { title: 'Lượt Truy Cập', value: '4,500', icon: Users, color: 'text-emerald-500' },
    { title: 'Tỷ Lệ Chuyển Đổi', value: '3.2%', icon: TrendingUp, color: 'text-purple-500' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-charcoal-900">Tổng quan kinh doanh</h1>
        <button className="bg-primary text-white px-4 py-2 rounded-base font-semibold hover:bg-primary-hover transition-colors">
          Tải báo cáo
        </button>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, i) => (
          <div key={i} className="bg-white p-6 rounded-xl border border-charcoal-200 shadow-sm flex items-start justify-between">
            <div>
              <p className="text-sm font-semibold text-charcoal-500 mb-1">{stat.title}</p>
              <h3 className="text-2xl font-bold text-charcoal-900">{stat.value}</h3>
            </div>
            <div className={`p-3 bg-charcoal-50 rounded-full ${stat.color}`}>
              <stat.icon size={24} />
            </div>
          </div>
        ))}
      </div>

      {/* Temporary Placeholder for charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="col-span-2 bg-white p-6 rounded-xl border border-charcoal-200 shadow-sm min-h-[400px] flex items-center justify-center">
          <p className="text-charcoal-400 font-medium">Biểu đồ doanh thu (Mock)</p>
        </div>
        <div className="bg-white p-6 rounded-xl border border-charcoal-200 shadow-sm min-h-[400px] flex items-center justify-center">
          <p className="text-charcoal-400 font-medium">Top sản phẩm bán chạy (Mock)</p>
        </div>
      </div>
    </div>
  );
};
