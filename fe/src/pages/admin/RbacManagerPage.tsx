import React, { useState, useMemo } from 'react';
import { ShieldCheck, Search, Users, Plus, Edit2, Trash2, Key, Save } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';

export const RbacManagerPage: React.FC = () => {
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'add' | 'edit'>('add');
  const [selectedRole, setSelectedRole] = useState<string | null>(null);

  const handleOpenModal = (mode: 'add' | 'edit') => {
    setModalMode(mode);
    setIsUserModalOpen(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setIsUserModalOpen(false);
    alert(modalMode === 'add' ? 'Thêm tài khoản thành công!' : 'Cập nhật tài khoản thành công!');
  };

  const rolesData = [
    { id: 'System Admin', title: 'System Admin', count: 1, desc: 'Toàn quyền hệ thống' },
    { id: 'Manager', title: 'Manager', count: 4, desc: 'Quản lý bán hàng, báo cáo, kho' },
    { id: 'Nhân viên POS', title: 'Nhân viên POS', count: 12, desc: 'Bán hàng tại quầy, lập đơn' },
  ];

  const mockUsers = [
    { id: 'TK001', username: 'admin_root', name: 'Lê Quản Trị', role: 'System Admin', status: 'ACTIVE' },
    { id: 'TK002', username: 'tran_quanly', name: 'Trần Quản Lý', role: 'Manager', status: 'ACTIVE' },
    { id: 'TK004', username: 'hoang_quanly', name: 'Hoàng Quản Lý', role: 'Manager', status: 'ACTIVE' },
    { id: 'TK003', username: 'nguyen_nhanvien', name: 'Nguyễn Nhân Viên', role: 'Nhân viên POS', status: 'INACTIVE' },
    { id: 'TK005', username: 'pham_pos', name: 'Phạm Bán Hàng', role: 'Nhân viên POS', status: 'ACTIVE' },
  ];

  // Lọc user theo Role
  const filteredUsers = useMemo(() => {
    if (!selectedRole) return mockUsers;
    return mockUsers.filter(user => user.role === selectedRole);
  }, [selectedRole]);

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h1 className="text-2xl font-bold text-charcoal-900 flex items-center gap-2">
          <div className="p-2 bg-primary/10 text-primary rounded-xl">
            <ShieldCheck size={24} />
          </div>
          Phân quyền & Tài khoản (RBAC)
        </h1>
        <p className="text-charcoal-500 text-sm mt-1 font-medium">Quản lý người dùng, vai trò và phân quyền truy cập hệ thống</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Roles List */}
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-white border border-charcoal-100 rounded-2xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-charcoal-900 flex items-center gap-2">
                <Key size={18} className="text-primary"/> Vai trò (Roles)
              </h2>
              <button className="p-1.5 bg-primary/10 text-primary hover:bg-primary/20 hover:text-primary-hover rounded-lg transition-colors border border-primary/20"><Plus size={18}/></button>
            </div>
            
            <div className="space-y-3">
              {rolesData.map(role => {
                const isActive = selectedRole === role.id;
                return (
                  <div 
                    key={role.id}
                    onClick={() => setSelectedRole(isActive ? null : role.id)}
                    className={`p-4 rounded-xl cursor-pointer transition-all duration-300 relative overflow-hidden group shadow-sm hover:shadow ${
                      isActive 
                        ? 'bg-primary/5 border-2 border-primary/40 shadow-primary/10' 
                        : 'bg-white border border-charcoal-100 hover:border-charcoal-200 hover:bg-charcoal-50'
                    }`}
                  >
                    {isActive && <div className="absolute inset-0 bg-gradient-to-r from-primary/10 to-transparent opacity-100 transition-opacity"></div>}
                    <div className="flex justify-between items-center mb-1 relative z-10">
                      <h3 className={`font-bold transition-colors ${isActive ? 'text-primary' : 'text-charcoal-800'}`}>{role.title}</h3>
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full transition-colors ${
                        isActive 
                          ? 'bg-white text-primary border border-primary/20 shadow-sm'
                          : 'bg-charcoal-100 text-charcoal-600'
                      }`}>
                        {role.count} user
                      </span>
                    </div>
                    <p className={`text-xs font-medium relative z-10 transition-colors ${isActive ? 'text-primary/80' : 'text-charcoal-500'}`}>{role.desc}</p>
                  </div>
                );
              })}
            </div>
            {selectedRole && (
              <div className="mt-4 text-center animate-in fade-in">
                <button 
                  onClick={() => setSelectedRole(null)}
                  className="text-sm font-semibold text-charcoal-500 hover:text-primary transition-colors underline"
                >
                  Xóa bộ lọc (Xem tất cả)
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Users List */}
        <div className="lg:col-span-2">
          <div className="bg-white border border-charcoal-100 rounded-2xl shadow-sm overflow-hidden h-full flex flex-col">
            <div className="p-5 border-b border-charcoal-100 flex flex-col sm:flex-row justify-between items-center gap-4 bg-charcoal-50/50">
              <h2 className="text-lg font-bold text-charcoal-900 flex items-center gap-2">
                <Users size={18} className="text-primary"/> 
                Danh sách Tài khoản
                {selectedRole && <Badge className="ml-2 bg-primary/10 text-primary border border-primary/20">{selectedRole}</Badge>}
              </h2>
              <div className="flex items-center gap-3 w-full sm:w-auto">
                <div className="relative group w-full sm:w-64">
                  <input 
                    type="text" 
                    placeholder="Tìm kiếm username, tên..." 
                    className="w-full pl-11 pr-4 py-2 bg-white border border-charcoal-200 rounded-xl focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none text-sm text-charcoal-900 transition-all shadow-sm" 
                  />
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-charcoal-400 group-hover:text-primary transition-colors" size={16} />
                </div>
                <button onClick={() => handleOpenModal('add')} className="flex items-center gap-2 px-5 py-2 bg-gradient-to-r from-primary to-orange-500 text-white rounded-xl text-sm font-bold shadow-md hover:shadow-lg hover:-translate-y-0.5 active:scale-95 transition-all whitespace-nowrap">
                  <Plus size={18} /> Thêm TK
                </button>
              </div>
            </div>

            <div className="overflow-x-auto flex-1">
              <table className="w-full text-sm text-left">
                <thead className="bg-charcoal-50/50 text-charcoal-500 font-bold uppercase tracking-wider text-xs border-b border-charcoal-100">
                  <tr>
                    <th className="px-6 py-5">Tên đăng nhập</th>
                    <th className="px-6 py-5">Họ và Tên</th>
                    <th className="px-6 py-5">Vai trò</th>
                    <th className="px-6 py-5">Trạng thái</th>
                    <th className="px-6 py-5 text-center">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-charcoal-50 relative">
                  {filteredUsers.length > 0 ? (
                    filteredUsers.map((user, idx) => (
                      <tr 
                        key={user.id} 
                        className="hover:bg-primary/5 transition-colors group animate-in fade-in fill-mode-both"
                        style={{ animationDelay: `${idx * 50}ms` }}
                      >
                        <td className="px-6 py-4">
                          <span className="font-bold text-charcoal-900 group-hover:text-primary transition-colors">{user.username}</span>
                          <p className="text-xs text-charcoal-400 font-medium">{user.id}</p>
                        </td>
                        <td className="px-6 py-4 font-bold text-charcoal-800">{user.name}</td>
                        <td className="px-6 py-4">
                          <span className="bg-charcoal-100 text-charcoal-700 px-2.5 py-1 rounded-md text-xs font-bold border border-charcoal-200">{user.role}</span>
                        </td>
                        <td className="px-6 py-4">
                          {user.status === 'ACTIVE' 
                            ? <Badge className="bg-emerald-100/80 text-emerald-800 border border-emerald-200 shadow-sm">Hoạt động</Badge> 
                            : <Badge className="bg-charcoal-100 text-charcoal-500 border border-charcoal-200 shadow-sm">Đã khóa</Badge>
                          }
                        </td>
                        <td className="px-6 py-4 text-center">
                          <div className="flex items-center justify-center gap-2 opacity-60 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => handleOpenModal('edit')} className="p-2 bg-white text-charcoal-400 hover:text-primary hover:bg-primary/10 rounded-lg transition-all border border-charcoal-100 shadow-sm hover:border-primary/30" title="Sửa"><Edit2 size={16}/></button>
                            <button className="p-2 bg-white text-charcoal-400 hover:text-crimson hover:bg-red-50 rounded-lg transition-all border border-charcoal-100 shadow-sm hover:border-red-200" title="Xóa"><Trash2 size={16}/></button>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="px-6 py-12 text-center text-charcoal-500 animate-in fade-in">
                        Không tìm thấy tài khoản nào thuộc vai trò <strong>{selectedRole}</strong>.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Modal Thêm/Sửa Tài khoản (Unified Theme) */}
      <Modal isOpen={isUserModalOpen} onClose={() => setIsUserModalOpen(false)} title={modalMode === 'add' ? 'Thêm Tài khoản mới' : 'Chỉnh sửa Tài khoản'} maxWidth="md">
        <form onSubmit={handleSave} className="space-y-5">
          <div className="bg-charcoal-50/50 p-5 rounded-2xl border border-charcoal-200 space-y-4 shadow-sm">
            <h3 className="font-bold text-charcoal-900 text-sm border-b border-charcoal-200 pb-2">Thông tin đăng nhập (TAI_KHOAN)</h3>
            <div>
              <label className="block text-sm font-semibold text-charcoal-700 mb-1">Tên đăng nhập (Username)</label>
              <input type="text" defaultValue={modalMode === 'edit' ? 'tran_quanly' : ''} disabled={modalMode === 'edit'} className="w-full px-4 py-2 bg-white border border-charcoal-200 rounded-xl focus:ring-2 focus:ring-primary outline-none disabled:bg-charcoal-100 disabled:text-charcoal-500 shadow-sm" required />
            </div>
            <div className="grid grid-cols-2 gap-4">
               <div>
                <label className="block text-sm font-semibold text-charcoal-700 mb-1">Mật khẩu</label>
                <input type="password" placeholder={modalMode === 'edit' ? 'Bỏ trống nếu ko đổi' : ''} className="w-full px-4 py-2 bg-white border border-charcoal-200 rounded-xl focus:ring-2 focus:ring-primary outline-none shadow-sm" required={modalMode === 'add'} />
              </div>
              <div>
                <label className="block text-sm font-semibold text-charcoal-700 mb-1">Vai trò (Role)</label>
                <select className="w-full px-4 py-2 bg-white border border-charcoal-200 rounded-xl focus:ring-2 focus:ring-primary outline-none shadow-sm" defaultValue={modalMode === 'edit' ? 'Manager' : 'Nhân viên POS'}>
                  <option>System Admin</option>
                  <option>Manager</option>
                  <option>Nhân viên POS</option>
                </select>
              </div>
            </div>
          </div>

          <div className="bg-charcoal-50/50 p-5 rounded-2xl border border-charcoal-200 space-y-4 shadow-sm">
            <h3 className="font-bold text-charcoal-900 text-sm border-b border-charcoal-200 pb-2">Hồ sơ nhân viên (NHAN_VIEN)</h3>
            <div>
              <label className="block text-sm font-semibold text-charcoal-700 mb-1">Họ và Tên</label>
              <input type="text" defaultValue={modalMode === 'edit' ? 'Trần Quản Lý' : ''} className="w-full px-4 py-2 bg-white border border-charcoal-200 rounded-xl focus:ring-2 focus:ring-primary outline-none shadow-sm" required />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-charcoal-700 mb-1">Số điện thoại</label>
                <input type="tel" defaultValue={modalMode === 'edit' ? '0987654321' : ''} className="w-full px-4 py-2 bg-white border border-charcoal-200 rounded-xl focus:ring-2 focus:ring-primary outline-none shadow-sm" required />
              </div>
              <div>
                <label className="block text-sm font-semibold text-charcoal-700 mb-1">Trạng thái</label>
                <select className="w-full px-4 py-2 bg-white border border-charcoal-200 rounded-xl focus:ring-2 focus:ring-primary outline-none shadow-sm">
                  <option value="ACTIVE">Hoạt động</option>
                  <option value="INACTIVE">Khóa tài khoản</option>
                </select>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-3">
            <button type="button" onClick={() => setIsUserModalOpen(false)} className="px-5 py-2.5 border border-charcoal-200 text-charcoal-700 font-bold rounded-xl hover:bg-charcoal-50 transition-colors">Hủy bỏ</button>
            <button type="submit" className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-primary to-orange-500 text-white font-bold rounded-xl hover:shadow-lg hover:-translate-y-0.5 transition-all">
              <Save size={18} /> {modalMode === 'add' ? 'Lưu tài khoản' : 'Cập nhật'}
            </button>
          </div>
        </form>
      </Modal>

    </div>
  );
};
