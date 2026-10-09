import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/features/auth/context/AuthContext';
import { LogIn, AlertCircle } from 'lucide-react';

export const LoginPage: React.FC = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Default redirect based on role will be handled after login
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      // Wait for state to update, then navigate based on role happens in App.tsx or here.
      // Let's force a redirect check here to speed up demo
      const stored = localStorage.getItem('fasearch_user');
      if (stored) {
        const user = JSON.parse(stored);
        if (user.role === 'ADMIN') navigate('/admin');
        else if (user.role === 'MANAGER') navigate('/manager');
        else navigate('/');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const autofill = (role: 'CUSTOMER' | 'MANAGER' | 'ADMIN') => {
    setPassword('123');
    if (role === 'CUSTOMER') setEmail('user@fasearch.vn');
    if (role === 'MANAGER') setEmail('manager@fasearch.vn');
    if (role === 'ADMIN') setEmail('admin@fasearch.vn');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-subtle p-4">
      <div className="max-w-md w-full bg-white rounded-xl shadow-card p-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-extrabold text-charcoal-900 tracking-tight">
            FAS<span className="text-primary">SEARCH</span>
          </h1>
          <p className="text-charcoal-500 mt-2">Đăng nhập vào hệ thống</p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-crimson-light text-crimson rounded-base flex items-center gap-2 text-sm font-medium">
            <AlertCircle size={18} />
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-charcoal-700 mb-1">Email</label>
            <input 
              type="email" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-2 border border-charcoal-200 rounded-base focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all"
              placeholder="Nhập email..."
              required
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-charcoal-700 mb-1">Mật khẩu</label>
            <input 
              type="password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2 border border-charcoal-200 rounded-base focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all"
              placeholder="Nhập mật khẩu..."
              required
            />
          </div>

          <button 
            type="submit" 
            disabled={loading}
            className="w-full flex justify-center items-center gap-2 bg-primary text-white py-2.5 rounded-base font-semibold hover:bg-primary-hover active:scale-95 transition-all disabled:opacity-70 disabled:active:scale-100"
          >
            {loading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <LogIn size={18} />}
            {loading ? 'Đang xử lý...' : 'Đăng nhập'}
          </button>
        </form>

        <div className="mt-8 pt-6 border-t border-charcoal-200">
          <p className="text-xs text-center text-charcoal-500 font-medium mb-3 uppercase tracking-wider">Tài khoản Demo nhanh</p>
          <div className="grid grid-cols-3 gap-2">
            <button onClick={() => autofill('CUSTOMER')} className="px-2 py-2 text-xs font-semibold rounded-base bg-charcoal-100 text-charcoal-700 hover:bg-charcoal-200 transition-colors">
              User
            </button>
            <button onClick={() => autofill('MANAGER')} className="px-2 py-2 text-xs font-semibold rounded-base bg-primary-light text-primary hover:bg-primary/20 transition-colors">
              Manager
            </button>
            <button onClick={() => autofill('ADMIN')} className="px-2 py-2 text-xs font-semibold rounded-base bg-indigo-50 text-indigo-700 hover:bg-indigo-100 transition-colors">
              Admin
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
