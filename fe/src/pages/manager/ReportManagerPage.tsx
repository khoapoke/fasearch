import React, { useState } from 'react';
import { BarChart3, TrendingUp, Calendar, Download, PieChart, TrendingDown } from 'lucide-react';
import { formatVND } from '@/utils/format';

export const ReportManagerPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'revenue' | 'products'>('revenue');
  const [fromDate, setFromDate] = useState('2026-10-01');
  const [toDate, setToDate] = useState('2026-10-08');

  // CSS-based simple bar chart mock data
  const revenueData = [
    { label: 'T2', value: 45000000, height: 'h-[45%]' },
    { label: 'T3', value: 52000000, height: 'h-[52%]' },
    { label: 'T4', value: 38000000, height: 'h-[38%]' },
    { label: 'T5', value: 65000000, height: 'h-[65%]' },
    { label: 'T6', value: 89000000, height: 'h-[89%]' },
    { label: 'T7', value: 112000000, height: 'h-[100%]' },
    { label: 'CN', value: 95000000, height: 'h-[95%]' },
  ];

  const topProducts = [
    { name: 'Áo Thun Nam Basic', sold: 450, revenue: 67500000 },
    { name: 'Quần Jean Ống Rộng Y2K', sold: 320, revenue: 89600000 },
    { name: 'Váy Dáng Dài Vintage', sold: 215, revenue: 75250000 },
    { name: 'Áo Khoác Bomber Unisex', sold: 180, revenue: 81000000 },
  ];

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col xl:flex-row justify-between gap-4 items-start xl:items-center">
        <h1 className="text-2xl font-bold text-charcoal-900 flex items-center gap-2 whitespace-nowrap">
          <div className="p-2 bg-primary/10 text-primary rounded-xl">
            <BarChart3 size={24} />
          </div>
          Báo cáo & Thống kê
        </h1>
        
        {/* Date Filter */}
        <div className="flex flex-wrap items-center gap-3 w-full xl:w-auto bg-white p-2 rounded-xl border border-charcoal-200 shadow-sm hover:shadow-md transition-shadow duration-300">
          <div className="flex items-center gap-2 px-2 border-r border-charcoal-200">
            <Calendar size={18} className="text-charcoal-400" />
            <span className="text-sm font-semibold text-charcoal-700">Từ</span>
            <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} className="text-sm border-none outline-none font-medium text-charcoal-900 bg-transparent cursor-pointer hover:text-primary transition-colors" />
          </div>
          <div className="flex items-center gap-2 px-2">
            <span className="text-sm font-semibold text-charcoal-700">Đến</span>
            <input type="date" value={toDate} onChange={e => setToDate(e.target.value)} className="text-sm border-none outline-none font-medium text-charcoal-900 bg-transparent cursor-pointer hover:text-primary transition-colors" />
          </div>
          <button className="ml-auto xl:ml-2 bg-charcoal-900 text-white px-5 py-2 rounded-lg text-sm font-semibold hover:bg-charcoal-800 active:scale-95 transition-all duration-300">
            Lọc
          </button>
        </div>

        <button className="flex items-center gap-2 bg-gradient-to-r from-emerald-500 to-teal-500 text-white px-5 py-2 rounded-xl text-sm font-bold shadow-md hover:shadow-lg hover:-translate-y-0.5 active:scale-95 transition-all duration-300 whitespace-nowrap">
          <Download size={18} /> Xuất Excel
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="group bg-gradient-to-br from-primary to-orange-500 p-6 rounded-2xl shadow-md hover:shadow-xl hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between h-36 relative overflow-hidden text-white cursor-default">
          <div className="absolute top-4 right-4 p-4 opacity-20 group-hover:scale-110 group-hover:rotate-12 transition-transform duration-500"><TrendingUp size={80} /></div>
          <p className="text-sm font-semibold text-white/90 drop-shadow-sm">Tổng doanh thu</p>
          <h3 className="text-3xl font-black drop-shadow-md tracking-tight">{formatVND(496000000)}</h3>
          <p className="text-xs font-bold text-white/90 flex items-center gap-1 bg-white/20 w-fit px-2 py-1 rounded-full backdrop-blur-sm"><TrendingUp size={12}/> +12.5% so với kỳ trước</p>
        </div>
        
        <div className="group bg-white p-6 rounded-2xl border border-charcoal-100 shadow-md hover:shadow-xl hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between h-36 relative overflow-hidden cursor-default">
           <div className="absolute top-4 right-4 p-4 opacity-5 text-indigo-600 group-hover:scale-110 group-hover:-rotate-12 transition-transform duration-500"><PieChart size={80} /></div>
          <p className="text-sm font-semibold text-charcoal-500">Tổng đơn hàng hoàn thành</p>
          <h3 className="text-3xl font-black text-charcoal-900 tracking-tight">1,245</h3>
          <p className="text-xs font-bold text-emerald-500 flex items-center gap-1 bg-emerald-50 w-fit px-2 py-1 rounded-full"><TrendingUp size={12}/> +5.2% so với kỳ trước</p>
        </div>

        <div className="group bg-white p-6 rounded-2xl border border-charcoal-100 shadow-md hover:shadow-xl hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between h-36 relative overflow-hidden cursor-default">
          <div className="absolute top-4 right-4 p-4 opacity-5 text-crimson group-hover:scale-110 group-hover:rotate-12 transition-transform duration-500"><TrendingDown size={80} /></div>
          <p className="text-sm font-semibold text-charcoal-500">Tỷ lệ hoàn trả (Đổi/Trả)</p>
          <h3 className="text-3xl font-black text-charcoal-900 tracking-tight">2.1%</h3>
          <p className="text-xs font-bold text-emerald-500 flex items-center gap-1 bg-emerald-50 w-fit px-2 py-1 rounded-full"><TrendingDown size={12}/> -0.5% so với kỳ trước (Tốt)</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-charcoal-100 shadow-md overflow-hidden">
        {/* Tabs */}
        <div className="flex border-b border-charcoal-100 bg-charcoal-50/50 overflow-x-auto scrollbar-hide">
          <button onClick={() => setActiveTab('revenue')} className={`px-8 py-4 font-bold text-sm transition-all duration-300 whitespace-nowrap relative ${activeTab === 'revenue' ? 'text-primary' : 'text-charcoal-500 hover:text-charcoal-900 hover:bg-charcoal-100'}`}>
            Biểu đồ Doanh thu
            {activeTab === 'revenue' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-primary rounded-t-full shadow-[0_-2px_10px_rgba(255,77,0,0.5)]"></div>}
          </button>
          <button onClick={() => setActiveTab('products')} className={`px-8 py-4 font-bold text-sm transition-all duration-300 whitespace-nowrap relative ${activeTab === 'products' ? 'text-primary' : 'text-charcoal-500 hover:text-charcoal-900 hover:bg-charcoal-100'}`}>
            Hiệu quả Sản phẩm
            {activeTab === 'products' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-primary rounded-t-full shadow-[0_-2px_10px_rgba(255,77,0,0.5)]"></div>}
          </button>
        </div>

        <div className="p-8">
          {activeTab === 'revenue' && (
            <div className="h-80 flex items-end gap-2 sm:gap-8 justify-between pt-10">
              {revenueData.map((data, idx) => (
                <div key={idx} className="flex-1 flex flex-col items-center gap-3 group relative h-full justify-end">
                  <div className="opacity-0 group-hover:opacity-100 -translate-y-2 group-hover:-translate-y-4 transition-all duration-300 bg-charcoal-900 text-white text-xs py-1.5 px-3 rounded-lg font-bold whitespace-nowrap absolute top-0 shadow-lg z-10 pointer-events-none">
                    {formatVND(data.value)}
                    {/* Tooltip arrow */}
                    <div className="absolute bottom-[-4px] left-1/2 -translate-x-1/2 w-2 h-2 bg-charcoal-900 rotate-45"></div>
                  </div>
                  <div className={`w-full max-w-[5rem] bg-gradient-to-t from-primary-light to-primary/60 group-hover:from-primary group-hover:to-orange-400 transition-all duration-500 rounded-t-xl ${data.height} shadow-sm group-hover:shadow-md cursor-pointer relative overflow-hidden`}>
                     {/* Glossy effect */}
                     <div className="absolute inset-0 w-full h-full bg-gradient-to-b from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                  </div>
                  <span className="text-sm font-bold text-charcoal-500 group-hover:text-charcoal-900 transition-colors">{data.label}</span>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'products' && (
            <div className="overflow-x-auto animate-in fade-in duration-300">
              <table className="w-full text-sm text-left">
                <thead className="text-charcoal-400 font-bold uppercase tracking-wider text-xs border-b border-charcoal-100">
                  <tr>
                    <th className="px-4 py-4">Top Sản Phẩm Bán Chạy</th>
                    <th className="px-4 py-4 text-right">Số lượng bán</th>
                    <th className="px-4 py-4 text-right">Doanh thu mang lại</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-charcoal-50">
                  {topProducts.map((prod, idx) => (
                    <tr key={idx} className="hover:bg-charcoal-50/80 transition-colors group">
                      <td className="px-4 py-5 font-bold text-charcoal-900 flex items-center gap-4">
                        <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-black shadow-sm ${idx === 0 ? 'bg-yellow-100 text-yellow-600' : idx === 1 ? 'bg-slate-200 text-slate-600' : idx === 2 ? 'bg-orange-100 text-orange-600' : 'bg-charcoal-100 text-charcoal-500'}`}>
                          {idx + 1}
                        </span>
                        <span className="group-hover:text-primary transition-colors">{prod.name}</span>
                      </td>
                      <td className="px-4 py-5 text-right font-bold text-charcoal-700">{prod.sold}</td>
                      <td className="px-4 py-5 text-right font-black text-primary text-base">{formatVND(prod.revenue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
