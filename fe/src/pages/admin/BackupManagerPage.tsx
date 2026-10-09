import React, { useState } from 'react';
import { Database, Plus, DownloadCloud, RotateCcw, AlertTriangle, CheckCircle2, XCircle, Loader2, Upload, History, FileText } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';

export const BackupManagerPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'backups' | 'history'>('backups');

  const [backups, setBackups] = useState([
    { id: 'BK-20261008-01', time: '2026-10-08 00:00:00', size: '2.4 GB', type: 'Tự động', status: 'SUCCESS' },
    { id: 'BK-20261007-01', time: '2026-10-07 00:00:00', size: '2.3 GB', type: 'Tự động', status: 'SUCCESS' },
    { id: 'BK-20261006-02', time: '2026-10-06 14:30:00', size: '2.3 GB', type: 'Thủ công', status: 'SUCCESS' },
    { id: 'BK-20261006-01', time: '2026-10-06 00:00:00', size: '0 MB', type: 'Tự động', status: 'ERROR' },
  ]);

  const [restoreHistory, setRestoreHistory] = useState([
    { id: 'RST-20261005-01', time: '2026-10-05 15:30:00', source: 'BK-20261004-01', user: 'Lê Quản Trị', status: 'SUCCESS', type: 'Từ hệ thống' },
    { id: 'RST-20260920-01', time: '2026-09-20 09:15:00', source: 'backup_local_final.sql', user: 'Lê Quản Trị', status: 'SUCCESS', type: 'Tải lên (File)' },
  ]);

  const [isBackupModalOpen, setIsBackupModalOpen] = useState(false);
  const [isRestoreModalOpen, setIsRestoreModalOpen] = useState(false);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  
  const [selectedBackup, setSelectedBackup] = useState<any>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [uploadFileName, setUploadFileName] = useState('');

  const handleCreateBackup = () => {
    setIsProcessing(true);
    setTimeout(() => {
      const now = new Date();
      const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
      const timeStr = now.toTimeString().slice(0, 8);
      
      const newBackup = {
        id: `BK-${dateStr}-MOCK`,
        time: `${now.toISOString().slice(0, 10)} ${timeStr}`,
        size: '2.45 GB',
        type: 'Thủ công',
        status: 'SUCCESS'
      };
      
      setBackups([newBackup, ...backups]);
      setIsProcessing(false);
      setIsBackupModalOpen(false);
      setTimeout(() => alert('Tạo bản sao lưu thành công!'), 100);
    }, 2000);
  };

  const handleConfirmRestore = () => {
    setIsProcessing(true);
    setTimeout(() => {
      const now = new Date();
      const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
      
      // Thêm vào lịch sử
      const newHistory = {
        id: `RST-${dateStr}-MOCK`,
        time: now.toLocaleString('vi-VN'),
        source: selectedBackup ? selectedBackup.id : uploadFileName,
        user: 'Lê Quản Trị',
        status: 'SUCCESS',
        type: selectedBackup ? 'Từ hệ thống' : 'Tải lên (File)'
      };
      setRestoreHistory([newHistory, ...restoreHistory]);
      
      setIsProcessing(false);
      setIsRestoreModalOpen(false);
      setIsUploadModalOpen(false);
      setUploadFileName('');
      setTimeout(() => alert('Khôi phục dữ liệu thành công! Hệ thống đang tự động tải lại...'), 100);
    }, 2500);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setUploadFileName(e.target.files[0].name);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-charcoal-900 flex items-center gap-2">
            <div className="p-2 bg-primary/10 text-primary rounded-xl">
              <Database size={24} />
            </div>
            Sao lưu & Phục hồi hệ thống
          </h1>
          <p className="text-charcoal-500 text-sm mt-1 font-medium">Quản lý các bản sao lưu, phục hồi dữ liệu từ file và lịch sử thao tác</p>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={() => setIsUploadModalOpen(true)}
            className="flex items-center gap-2 px-5 py-2.5 bg-white border border-charcoal-200 text-charcoal-700 rounded-xl text-sm font-bold shadow-sm hover:text-primary hover:border-primary/50 transition-all whitespace-nowrap"
          >
            <Upload size={18} /> Phục hồi từ File
          </button>
          <button 
            onClick={() => setIsBackupModalOpen(true)}
            className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-primary to-orange-500 text-white rounded-xl text-sm font-bold shadow-md hover:shadow-lg hover:-translate-y-0.5 active:scale-95 transition-all whitespace-nowrap"
          >
            <Plus size={18} /> Tạo sao lưu mới
          </button>
        </div>
      </div>

      <div className="bg-white border border-charcoal-100 rounded-2xl shadow-sm overflow-hidden flex flex-col">
        {/* Tabs */}
        <div className="flex border-b border-charcoal-100 bg-charcoal-50/50">
          <button 
            onClick={() => setActiveTab('backups')} 
            className={`flex items-center gap-2 px-8 py-4 font-bold text-sm transition-all duration-300 relative ${activeTab === 'backups' ? 'text-primary bg-white' : 'text-charcoal-500 hover:text-charcoal-900 hover:bg-charcoal-100/50'}`}
          >
            <Database size={18} /> Danh sách Bản sao lưu
            {activeTab === 'backups' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-primary rounded-t-full shadow-[0_-2px_10px_rgba(255,77,0,0.5)]"></div>}
          </button>
          <button 
            onClick={() => setActiveTab('history')} 
            className={`flex items-center gap-2 px-8 py-4 font-bold text-sm transition-all duration-300 relative ${activeTab === 'history' ? 'text-primary bg-white' : 'text-charcoal-500 hover:text-charcoal-900 hover:bg-charcoal-100/50'}`}
          >
            <History size={18} /> Lịch sử Phục hồi
            {activeTab === 'history' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-primary rounded-t-full shadow-[0_-2px_10px_rgba(255,77,0,0.5)]"></div>}
          </button>
        </div>

        <div className="overflow-x-auto">
          {activeTab === 'backups' ? (
            <table className="w-full text-sm text-left">
              <thead className="bg-charcoal-50/30 text-charcoal-500 font-bold uppercase tracking-wider text-xs border-b border-charcoal-100">
                <tr>
                  <th className="px-6 py-5">Mã bản sao lưu</th>
                  <th className="px-6 py-5">Thời gian</th>
                  <th className="px-6 py-5">Dung lượng</th>
                  <th className="px-6 py-5">Loại</th>
                  <th className="px-6 py-5 text-center">Trạng thái</th>
                  <th className="px-6 py-5 text-center">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-charcoal-50">
                {backups.map((backup, idx) => (
                  <tr 
                    key={backup.id} 
                    className="hover:bg-primary/5 transition-colors group animate-in fade-in fill-mode-both"
                    style={{ animationDelay: `${idx * 50}ms` }}
                  >
                    <td className="px-6 py-5">
                      <span className="font-bold text-charcoal-900 group-hover:text-primary transition-colors">{backup.id}</span>
                    </td>
                    <td className="px-6 py-5 text-charcoal-600 font-medium">{backup.time}</td>
                    <td className="px-6 py-5 font-bold text-charcoal-700">{backup.size}</td>
                    <td className="px-6 py-5">
                      <span className="bg-charcoal-100 text-charcoal-700 px-2.5 py-1 rounded-md text-xs font-bold border border-charcoal-200">{backup.type}</span>
                    </td>
                    <td className="px-6 py-5 text-center">
                      {backup.status === 'SUCCESS' 
                        ? <Badge className="bg-emerald-100/80 text-emerald-800 border border-emerald-200 shadow-sm flex items-center justify-center gap-1 w-fit mx-auto"><CheckCircle2 size={14}/> Thành công</Badge> 
                        : <Badge className="bg-crimson/10 text-crimson border border-crimson/20 shadow-sm flex items-center justify-center gap-1 w-fit mx-auto"><XCircle size={14}/> Lỗi</Badge>
                      }
                    </td>
                    <td className="px-6 py-5 text-center">
                      <div className="flex items-center justify-center gap-2 opacity-60 group-hover:opacity-100 transition-opacity">
                        <button 
                          disabled={backup.status !== 'SUCCESS'}
                          className="p-2 bg-white text-charcoal-400 hover:text-primary hover:bg-primary/10 rounded-lg transition-all border border-charcoal-100 shadow-sm disabled:opacity-30 disabled:hover:bg-white disabled:hover:text-charcoal-400" 
                          title="Tải xuống (Download)"
                        >
                          <DownloadCloud size={16}/>
                        </button>
                        <button 
                          onClick={() => { setSelectedBackup(backup); setIsRestoreModalOpen(true); }}
                          disabled={backup.status !== 'SUCCESS'}
                          className="p-2 bg-white text-charcoal-400 hover:text-orange-500 hover:bg-orange-50 rounded-lg transition-all border border-charcoal-100 shadow-sm hover:border-orange-200 disabled:opacity-30 disabled:hover:bg-white disabled:hover:text-charcoal-400" 
                          title="Phục hồi hệ thống (Restore)"
                        >
                          <RotateCcw size={16}/>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <table className="w-full text-sm text-left">
              <thead className="bg-charcoal-50/30 text-charcoal-500 font-bold uppercase tracking-wider text-xs border-b border-charcoal-100">
                <tr>
                  <th className="px-6 py-5">Mã lần phục hồi</th>
                  <th className="px-6 py-5">Thời gian thực hiện</th>
                  <th className="px-6 py-5">Người thực hiện</th>
                  <th className="px-6 py-5">Nguồn dữ liệu (Source)</th>
                  <th className="px-6 py-5">Phương thức</th>
                  <th className="px-6 py-5 text-center">Trạng thái</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-charcoal-50">
                {restoreHistory.map((history, idx) => (
                  <tr 
                    key={history.id} 
                    className="hover:bg-primary/5 transition-colors group animate-in fade-in fill-mode-both"
                    style={{ animationDelay: `${idx * 50}ms` }}
                  >
                    <td className="px-6 py-5 font-mono text-xs font-bold text-charcoal-600 group-hover:text-primary transition-colors">{history.id}</td>
                    <td className="px-6 py-5 text-charcoal-600 font-medium">{history.time}</td>
                    <td className="px-6 py-5 font-bold text-charcoal-800">{history.user}</td>
                    <td className="px-6 py-5 font-bold text-primary flex items-center gap-1.5"><FileText size={14}/> {history.source}</td>
                    <td className="px-6 py-5">
                      <span className={`px-2.5 py-1 rounded-md text-xs font-bold border ${history.type === 'Từ hệ thống' ? 'bg-primary/10 text-primary border-primary/20' : 'bg-charcoal-100 text-charcoal-700 border-charcoal-200'}`}>
                        {history.type}
                      </span>
                    </td>
                    <td className="px-6 py-5 text-center">
                      <Badge className="bg-emerald-100/80 text-emerald-800 border border-emerald-200 shadow-sm flex items-center justify-center gap-1 w-fit mx-auto"><CheckCircle2 size={14}/> Thành công</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Modal: Tạo Bản Sao Lưu */}
      <Modal isOpen={isBackupModalOpen} onClose={() => !isProcessing && setIsBackupModalOpen(false)} title="Tạo bản sao lưu hệ thống" maxWidth="sm">
        <div className="space-y-4">
          <p className="text-charcoal-600 text-sm">
            Quá trình sao lưu sẽ nén toàn bộ cơ sở dữ liệu hiện tại (Database). Bạn có chắc chắn muốn tiến hành sao lưu thủ công ngay lúc này không?
          </p>
          <div className="flex justify-end gap-3 pt-4 border-t border-charcoal-100">
            <button 
              type="button" 
              disabled={isProcessing}
              onClick={() => setIsBackupModalOpen(false)} 
              className="px-4 py-2 border border-charcoal-200 text-charcoal-700 font-semibold rounded-xl hover:bg-charcoal-50 transition-colors disabled:opacity-50"
            >
              Hủy bỏ
            </button>
            <button 
              onClick={handleCreateBackup}
              disabled={isProcessing}
              className="flex items-center gap-2 px-6 py-2 bg-gradient-to-r from-primary to-orange-500 text-white font-semibold rounded-xl hover:shadow-lg transition-all disabled:opacity-70"
            >
              {isProcessing ? <Loader2 size={18} className="animate-spin" /> : <Database size={18} />}
              {isProcessing ? 'Đang sao lưu...' : 'Tiến hành sao lưu'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Modal: Tải File Phục Hồi Thủ Công */}
      <Modal isOpen={isUploadModalOpen} onClose={() => !isProcessing && setIsUploadModalOpen(false)} title="Phục hồi từ File (.sql, .zip)" maxWidth="md">
        <div className="space-y-5 text-charcoal-900">
          <p className="text-sm text-charcoal-600">
            Chọn một tệp sao lưu (.sql, .zip) từ máy tính của bạn để ghi đè lên dữ liệu hiện tại.
          </p>
          
          <div className="border-2 border-dashed border-charcoal-200 bg-charcoal-50 rounded-2xl p-8 flex flex-col items-center justify-center relative hover:bg-primary/5 hover:border-primary/40 transition-colors cursor-pointer group">
            <input type="file" accept=".sql,.zip" onChange={handleFileUpload} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
            <Upload size={32} className="text-charcoal-400 group-hover:text-primary mb-2 transition-colors" />
            <p className="text-sm font-bold text-charcoal-700 group-hover:text-primary">
              {uploadFileName ? uploadFileName : 'Nhấn để chọn tệp hoặc kéo thả vào đây'}
            </p>
            <p className="text-xs text-charcoal-400 mt-1">Hỗ trợ định dạng: .sql, .zip (Max 5GB)</p>
          </div>

          {uploadFileName && (
            <div className="p-4 bg-orange-50 border border-orange-200 rounded-xl flex items-start gap-3 animate-in fade-in">
              <AlertTriangle className="text-orange-500 shrink-0 mt-0.5" size={20} />
              <div>
                <h4 className="font-bold text-orange-800 text-sm mb-1">Xác nhận ghi đè dữ liệu</h4>
                <p className="text-orange-700 text-xs">
                  Bạn đang chuẩn bị phục hồi hệ thống từ tệp <strong className="font-mono">{uploadFileName}</strong>. Toàn bộ dữ liệu hiện tại sẽ biến mất và không thể hoàn tác!
                </p>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4 border-t border-charcoal-100">
            <button 
              type="button" 
              disabled={isProcessing}
              onClick={() => { setIsUploadModalOpen(false); setUploadFileName(''); setSelectedBackup(null); }} 
              className="px-4 py-2 border border-charcoal-200 text-charcoal-700 font-semibold rounded-xl hover:bg-charcoal-50 transition-colors disabled:opacity-50"
            >
              Hủy bỏ
            </button>
            <button 
              onClick={() => { setSelectedBackup(null); handleConfirmRestore(); }}
              disabled={isProcessing || !uploadFileName}
              className="flex items-center gap-2 px-6 py-2 bg-gradient-to-r from-orange-500 to-red-600 text-white font-semibold rounded-xl hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isProcessing ? <Loader2 size={18} className="animate-spin" /> : <RotateCcw size={18} />}
              {isProcessing ? 'Đang phục hồi...' : 'Phục hồi từ File'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Modal: Xác nhận Phục Hồi Từ Bảng (Restore) */}
      <Modal isOpen={isRestoreModalOpen} onClose={() => !isProcessing && setIsRestoreModalOpen(false)} title="CẢNH BÁO: Phục hồi hệ thống!" maxWidth="md">
        <div className="space-y-4">
          <div className="p-4 bg-orange-50 border border-orange-200 rounded-xl flex items-start gap-3">
            <AlertTriangle className="text-orange-500 shrink-0 mt-0.5" size={20} />
            <div>
              <h4 className="font-bold text-orange-800 text-sm mb-1">Thao tác này rất nguy hiểm!</h4>
              <p className="text-orange-700 text-xs">
                Toàn bộ dữ liệu hiện tại (Đơn hàng, Sản phẩm, Tài khoản) sẽ bị <strong>GHI ĐÈ</strong> hoàn toàn bởi bản sao lưu. 
                Bạn không thể hoàn tác hành động này.
              </p>
            </div>
          </div>
          
          <div className="bg-charcoal-50 p-4 rounded-xl border border-charcoal-100">
            <p className="text-sm text-charcoal-600 font-semibold mb-2">Bản sao lưu sẽ được áp dụng:</p>
            <div className="flex items-center justify-between">
              <span className="font-mono font-bold text-primary">{selectedBackup?.id}</span>
              <span className="text-xs font-bold text-charcoal-500">{selectedBackup?.time}</span>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-charcoal-100">
            <button 
              type="button" 
              disabled={isProcessing}
              onClick={() => setIsRestoreModalOpen(false)} 
              className="px-4 py-2 border border-charcoal-200 text-charcoal-700 font-semibold rounded-xl hover:bg-charcoal-50 transition-colors disabled:opacity-50"
            >
              Hủy bỏ
            </button>
            <button 
              onClick={handleConfirmRestore}
              disabled={isProcessing}
              className="flex items-center gap-2 px-6 py-2 bg-gradient-to-r from-orange-500 to-red-600 text-white font-semibold rounded-xl hover:shadow-lg transition-all disabled:opacity-70"
            >
              {isProcessing ? <Loader2 size={18} className="animate-spin" /> : <RotateCcw size={18} />}
              {isProcessing ? 'Đang phục hồi...' : 'Tôi hiểu, Phục hồi ngay'}
            </button>
          </div>
        </div>
      </Modal>

    </div>
  );
};
