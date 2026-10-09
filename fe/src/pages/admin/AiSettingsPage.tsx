import React from 'react';
import { Save, Cpu, Activity, Link as LinkIcon } from 'lucide-react';

export const AiSettingsPage: React.FC = () => {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <h1 className="text-2xl font-bold text-charcoal-900">Cấu hình AI Engine</h1>
        <button className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-base text-sm font-semibold hover:bg-indigo-700 transition-colors">
          <Save size={18} /> Lưu cấu hình
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-charcoal-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-charcoal-200 bg-charcoal-50 flex items-center gap-3">
            <LinkIcon className="text-indigo-600" size={20} />
            <h2 className="font-bold text-charcoal-900">Kết nối Vector Database</h2>
          </div>
          <div className="p-6 space-y-4">
            <div>
              <label className="block text-sm font-semibold text-charcoal-700 mb-1">Database Endpoint URL</label>
              <input type="text" defaultValue="https://vdb.fasearch.vn/api/v1" className="w-full px-4 py-2 border border-charcoal-200 rounded-base focus:ring-2 focus:ring-indigo-500 outline-none text-charcoal-900" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-charcoal-700 mb-1">API Key / Token</label>
              <input type="password" defaultValue="************************" className="w-full px-4 py-2 border border-charcoal-200 rounded-base focus:ring-2 focus:ring-indigo-500 outline-none text-charcoal-900" />
            </div>
            <div className="flex items-center gap-2 pt-2">
              <span className="flex h-3 w-3 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
              </span>
              <span className="text-sm font-semibold text-emerald-600">Đã kết nối thành công</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-charcoal-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-charcoal-200 bg-charcoal-50 flex items-center gap-3">
            <Cpu className="text-indigo-600" size={20} />
            <h2 className="font-bold text-charcoal-900">Model Embedding & Ngữ nghĩa</h2>
          </div>
          <div className="p-6 space-y-4">
            <div>
              <label className="block text-sm font-semibold text-charcoal-700 mb-1">Text-to-Image Model</label>
              <select className="w-full px-4 py-2 border border-charcoal-200 rounded-base focus:ring-2 focus:ring-indigo-500 outline-none text-charcoal-900 bg-white">
                <option>ViT-L/14 (OpenAI CLIP) - Mặc định</option>
                <option>ResNet-50</option>
                <option>Custom FashionSearch v2.0</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-charcoal-700 mb-1">Độ tương đồng tối thiểu (Threshold)</label>
              <div className="flex items-center gap-4">
                <input type="range" min="0" max="100" defaultValue="75" className="flex-1 h-2 bg-charcoal-200 rounded-lg appearance-none cursor-pointer accent-indigo-600" />
                <span className="text-sm font-bold text-indigo-600 w-12">75%</span>
              </div>
              <p className="text-xs text-charcoal-500 mt-1">Giới hạn phần trăm giống nhau để AI hiển thị kết quả cho khách hàng.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
