import React, { useState } from 'react';
import { Shield, Search, Download, Server, Cpu, HardDrive, Activity, Filter, Eye } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';

export const SystemAdminPage: React.FC = () => {
  const [isLogDetailOpen, setIsLogDetailOpen] = useState(false);
  const [selectedLog, setSelectedLog] = useState<any>(null);

  const systemLogs = [
    { id: 'LOG-1025', user: 'admin_root', role: 'System Admin', time: '2026-10-09 08:05:12', action: 'Cập nhật phân quyền (RBAC)', module: 'Bảo mật', data: 'Thay đổi quyền: Quản lý kho thêm quyền Xóa phiếu nhập.', status: 'SUCCESS' },
    { id: 'LOG-1024', user: 'tran_quanly', role: 'Manager', time: '2026-10-09 07:46:45', action: 'Cập nhật thông tin cá nhân', module: 'Tài khoản', data: 'Đổi địa chỉ, số điện thoại', status: 'SUCCESS' },
    { id: 'LOG-1023', user: 'system_auto', role: 'System', time: '2026-10-09 00:00:00', action: 'Backup Database Tự động', module: 'Hệ thống', data: 'Bản sao lưu: auto_backup_20261009.sql.gz', status: 'SUCCESS' },
    { id: 'LOG-1022', user: 'nguyen_nhanvien', role: 'Nhân viên POS', time: '2026-10-08 22:15:00', action: 'Đăng nhập thất bại (Sai mật khẩu)', module: 'Xác thực', data: 'IP: 192.168.1.45', status: 'WARNING' },
    { id: 'LOG-1021', user: 'tran_quanly', role: 'Manager', time: '2026-10-08 16:53:37', action: 'Lập phiếu nhập kho', module: 'Quản lý Kho', data: 'Mã Phiếu: PN-001 - Tổng SL: 50', status: 'SUCCESS' },
  ];

  const handleViewLog = (log: any) => {
    setSelectedLog(log);
    setIsLogDetailOpen(true);
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-charcoal-900 flex items-center gap-2">
            <div className="p-2 bg-primary/10 text-primary rounded-xl">
              <Shield size={24} />
            </div>
            Tổng quan Hệ thống
          </h1>
          <p className="text-charcoal-500 text-sm mt-1 font-medium">Giám sát tài nguyên và nhật ký hoạt động (Audit Logs)</p>
        </div>
      </div>

      {/* Server Health Metrics - Unified with Manager theme */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white border border-charcoal-100 rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow flex items-center gap-4 relative overflow-hidden group">
          <div className="absolute -right-6 -top-6 w-24 h-24 bg-emerald-50 rounded-full group-hover:scale-150 transition-transform duration-700 ease-out z-0"></div>
          <div className="p-3.5 bg-emerald-100 text-emerald-600 rounded-xl z-10 shadow-sm"><Server size={24} /></div>
          <div className="z-10">
            <p className="text-xs font-bold uppercase tracking-wider text-charcoal-500 mb-1">Trạng thái Server</p>
            <p className="text-xl font-extrabold text-charcoal-900 flex items-center gap-2">
              Online <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.8)]"></span>
            </p>
          </div>
        </div>
        
        <div className="bg-white border border-charcoal-100 rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow flex items-center gap-4 relative overflow-hidden group">
          <div className="absolute -right-6 -top-6 w-24 h-24 bg-blue-50 rounded-full group-hover:scale-150 transition-transform duration-700 ease-out z-0"></div>
          <div className="p-3.5 bg-blue-100 text-blue-600 rounded-xl z-10 shadow-sm"><Cpu size={24} /></div>
          <div className="z-10">
            <p className="text-xs font-bold uppercase tracking-wider text-charcoal-500 mb-1">CPU Usage</p>
            <p className="text-xl font-extrabold text-charcoal-900">24.5<span className="text-sm font-medium text-charcoal-500 ml-1">%</span></p>
          </div>
        </div>

        <div className="bg-white border border-charcoal-100 rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow flex items-center gap-4 relative overflow-hidden group">
          <div className="absolute -right-6 -top-6 w-24 h-24 bg-purple-50 rounded-full group-hover:scale-150 transition-transform duration-700 ease-out z-0"></div>
          <div className="p-3.5 bg-purple-100 text-purple-600 rounded-xl z-10 shadow-sm"><Activity size={24} /></div>
          <div className="z-10">
            <p className="text-xs font-bold uppercase tracking-wider text-charcoal-500 mb-1">RAM Usage</p>
            <p className="text-xl font-extrabold text-charcoal-900">4.2<span className="text-sm font-medium text-charcoal-500 ml-1">/ 16 GB</span></p>
          </div>
        </div>

        <div className="bg-white border border-charcoal-100 rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow flex items-center gap-4 relative overflow-hidden group">
          <div className="absolute -right-6 -top-6 w-24 h-24 bg-orange-50 rounded-full group-hover:scale-150 transition-transform duration-700 ease-out z-0"></div>
          <div className="p-3.5 bg-orange-100 text-orange-600 rounded-xl z-10 shadow-sm"><HardDrive size={24} /></div>
          <div className="z-10">
            <p className="text-xs font-bold uppercase tracking-wider text-charcoal-500 mb-1">Database Size</p>
            <p className="text-xl font-extrabold text-charcoal-900">1.8<span className="text-sm font-medium text-charcoal-500 ml-1">GB</span></p>
          </div>
        </div>
      </div>

      {/* Audit Logs Table */}
      <div className="bg-white border border-charcoal-100 rounded-2xl shadow-md overflow-hidden">
        <div className="p-5 border-b border-charcoal-100 flex flex-col sm:flex-row justify-between items-center gap-4 bg-charcoal-50/50">
          <h2 className="text-lg font-bold text-charcoal-900">Nhật ký hoạt động (Audit Logs)</h2>
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <div className="relative group w-full sm:w-72">
              <input 
                type="text" 
                placeholder="Tìm kiếm tài khoản, hành động..." 
                className="w-full pl-11 pr-4 py-2 bg-white border border-charcoal-200 rounded-xl focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none text-sm text-charcoal-900 transition-all shadow-sm"
              />
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-charcoal-400 group-hover:text-primary transition-colors" size={16} />
            </div>
            <button className="flex items-center gap-2 px-4 py-2 bg-white border border-charcoal-200 hover:border-primary/30 hover:text-primary rounded-xl text-sm font-bold text-charcoal-700 transition-all shadow-sm">
              <Filter size={16} /> Lọc
            </button>
            <button className="flex items-center gap-2 px-5 py-2 bg-gradient-to-r from-charcoal-800 to-charcoal-900 hover:from-charcoal-700 hover:to-charcoal-800 text-white rounded-xl text-sm font-bold shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all whitespace-nowrap active:scale-95">
              <Download size={16} /> Xuất Log
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-charcoal-50/50 text-charcoal-500 font-bold uppercase tracking-wider text-xs border-b border-charcoal-100">
              <tr>
                <th className="px-6 py-5">Mã NK</th>
                <th className="px-6 py-5">Thời gian</th>
                <th className="px-6 py-5">Tài khoản (MaTK)</th>
                <th className="px-6 py-5">Hành động</th>
                <th className="px-6 py-5">Module</th>
                <th className="px-6 py-5 text-center">Trạng thái</th>
                <th className="px-6 py-5 text-center">Chi tiết</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-charcoal-50">
              {systemLogs.map((log, idx) => (
                <tr 
                  key={log.id} 
                  className="hover:bg-primary/5 transition-colors group animate-in fade-in fill-mode-both"
                  style={{ animationDelay: `${idx * 50}ms` }}
                >
                  <td className="px-6 py-4 font-mono text-charcoal-400 text-xs font-semibold">{log.id}</td>
                  <td className="px-6 py-4 text-charcoal-600 font-medium whitespace-nowrap">{log.time}</td>
                  <td className="px-6 py-4">
                    <p className="font-bold text-charcoal-900 group-hover:text-primary transition-colors">{log.user}</p>
                    <p className="text-xs text-charcoal-500 font-medium">{log.role}</p>
                  </td>
                  <td className="px-6 py-4 font-bold text-charcoal-800">{log.action}</td>
                  <td className="px-6 py-4 text-charcoal-500 font-medium">{log.module}</td>
                  <td className="px-6 py-4 text-center">
                    {log.status === 'SUCCESS' ? (
                      <Badge className="bg-emerald-100/80 text-emerald-800 border border-emerald-200">Thành công</Badge>
                    ) : (
                      <Badge className="bg-yellow-100/80 text-yellow-800 border border-yellow-200">Cảnh báo</Badge>
                    )}
                  </td>
                  <td className="px-6 py-4 text-center">
                    <button 
                      onClick={() => handleViewLog(log)}
                      className="p-2 bg-white text-charcoal-400 hover:text-primary hover:bg-primary/10 hover:border-primary/20 rounded-lg transition-all border border-charcoal-100 shadow-sm opacity-60 group-hover:opacity-100"
                    >
                      <Eye size={18} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        <div className="p-5 border-t border-charcoal-100 bg-charcoal-50/30 flex items-center justify-between text-sm text-charcoal-500 font-medium">
          <span>Hiển thị <strong className="text-charcoal-900">1 - 5</strong> của <strong className="text-charcoal-900">1,025</strong> dòng nhật ký</span>
          <div className="flex gap-1.5">
            <button className="px-3.5 py-1.5 border border-charcoal-200 bg-white rounded-lg hover:bg-charcoal-50 hover:text-charcoal-900 transition-colors shadow-sm">Trước</button>
            <button className="px-3.5 py-1.5 bg-gradient-to-r from-primary to-orange-500 text-white font-bold rounded-lg shadow-md">1</button>
            <button className="px-3.5 py-1.5 border border-charcoal-200 bg-white rounded-lg hover:bg-charcoal-50 hover:text-charcoal-900 transition-colors shadow-sm">Sau</button>
          </div>
        </div>
      </div>

      {/* Log Detail Modal */}
      <Modal isOpen={isLogDetailOpen} onClose={() => setIsLogDetailOpen(false)} title="Chi tiết Nhật ký" maxWidth="md">
        {selectedLog && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-y-4 text-sm">
              <div className="col-span-1 text-charcoal-500 font-semibold">Mã Nhật Ký:</div>
              <div className="col-span-2 font-mono font-bold text-charcoal-900">{selectedLog.id}</div>
              
              <div className="col-span-1 text-charcoal-500 font-semibold">Thời gian:</div>
              <div className="col-span-2 font-medium text-charcoal-900">{selectedLog.time}</div>
              
              <div className="col-span-1 text-charcoal-500 font-semibold">Tài khoản:</div>
              <div className="col-span-2 font-bold text-charcoal-900">{selectedLog.user} <span className="font-normal text-charcoal-500">({selectedLog.role})</span></div>
              
              <div className="col-span-1 text-charcoal-500 font-semibold">Hành động:</div>
              <div className="col-span-2 font-medium text-charcoal-900">{selectedLog.action}</div>
            </div>
            
            <div className="mt-4 pt-4 border-t border-charcoal-100">
              <label className="block text-sm font-semibold text-charcoal-700 mb-2">Dữ liệu thay đổi (DuLieuThayDoi)</label>
              <div className="bg-charcoal-50 p-4 rounded-xl border border-charcoal-200 text-sm font-mono text-charcoal-800 break-words shadow-inner">
                {selectedLog.data}
              </div>
            </div>

            <div className="flex justify-end pt-4">
              <button onClick={() => setIsLogDetailOpen(false)} className="px-6 py-2 bg-charcoal-900 text-white rounded-xl font-bold hover:bg-charcoal-800 transition-colors shadow-sm hover:shadow-md">
                Đóng
              </button>
            </div>
          </div>
        )}
      </Modal>

    </div>
  );
};
