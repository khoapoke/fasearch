import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from '@/features/auth/context/AuthContext';
import { CartProvider } from '@/features/cart/context/CartContext';
import { Role } from '@/features/auth/types';

import { StorefrontLayout } from '@/components/layout/StorefrontLayout';
import { ManagerLayout } from '@/components/layout/ManagerLayout';
import { AdminLayout } from '@/components/layout/AdminLayout';

import { HomePage } from '@/pages/storefront/HomePage';
import { ProductDetailPage } from '@/pages/storefront/ProductDetailPage';
import { CartPage } from '@/pages/storefront/CartPage';
import { CheckoutPage } from '@/pages/storefront/CheckoutPage';
import { ProductCatalogPage } from '@/pages/storefront/ProductCatalogPage';
import { CategoryLandingPage } from '@/pages/storefront/CategoryLandingPage';
import { ProfilePage } from '@/pages/storefront/ProfilePage';

import { LoginPage } from '@/pages/auth/LoginPage';

import { DashboardPage } from '@/pages/manager/DashboardPage';
import { CategoryManagerPage } from '@/pages/manager/CategoryManagerPage';
import { ProductManagerPage } from '@/pages/manager/ProductManagerPage';
import { InventoryManagerPage } from '@/pages/manager/InventoryManagerPage';
import { OrderManagerPage } from '@/pages/manager/OrderManagerPage';
import { VoucherManagerPage } from '@/pages/manager/VoucherManagerPage';
import { ReportManagerPage } from '@/pages/manager/ReportManagerPage';

import { SystemAdminPage } from '@/pages/admin/SystemAdminPage';
import { RbacManagerPage } from '@/pages/admin/RbacManagerPage';
import { BackupManagerPage } from '@/pages/admin/BackupManagerPage';
import { AiSettingsPage } from '@/pages/admin/AiSettingsPage';

const RequireAuth: React.FC<{ children: React.ReactNode, allowedRoles: Role[] }> = ({ children, allowedRoles }) => {
  const { user, isLoading } = useAuth();

  if (isLoading) return <div className="min-h-screen flex items-center justify-center">Đang tải...</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (!allowedRoles.includes(user.role)) return <Navigate to="/" replace />;

  return <>{children}</>;
};

function AppRoutes() {
  return (
    <Routes>
      {/* Public Storefront */}
      <Route path="/" element={<StorefrontLayout><HomePage /></StorefrontLayout>} />
      <Route path="/product/:id" element={<StorefrontLayout><ProductDetailPage /></StorefrontLayout>} />
      <Route path="/cart" element={<StorefrontLayout><CartPage /></StorefrontLayout>} />
      <Route path="/checkout" element={<StorefrontLayout><CheckoutPage /></StorefrontLayout>} />
      <Route path="/profile" element={<StorefrontLayout><ProfilePage /></StorefrontLayout>} />
      
      {/* Category & Collection Routes */}
      <Route path="/new-arrivals" element={<StorefrontLayout><CategoryLandingPage /></StorefrontLayout>} />
      <Route path="/sale" element={<StorefrontLayout><CategoryLandingPage /></StorefrontLayout>} />
      <Route path="/category/:slug" element={<StorefrontLayout><CategoryLandingPage /></StorefrontLayout>} />
      <Route path="/collections" element={<StorefrontLayout><ProductCatalogPage /></StorefrontLayout>} />
      
      {/* Auth */}
      <Route path="/login" element={<LoginPage />} />

      {/* Manager Portal */}
      <Route 
        path="/manager/*" 
        element={
          <RequireAuth allowedRoles={['MANAGER']}>
            <ManagerLayout>
              <Routes>
                <Route path="/" element={<DashboardPage />} />
                <Route path="categories" element={<CategoryManagerPage />} />
                <Route path="products" element={<ProductManagerPage />} />
                <Route path="inventory" element={<InventoryManagerPage />} />
                <Route path="orders" element={<OrderManagerPage />} />
                <Route path="vouchers" element={<VoucherManagerPage />} />
                <Route path="reports" element={<ReportManagerPage />} />
                <Route path="*" element={<Navigate to="/manager" replace />} />
              </Routes>
            </ManagerLayout>
          </RequireAuth>
        } 
      />

      {/* Admin Portal */}
      <Route 
        path="/admin/*" 
        element={
          <RequireAuth allowedRoles={['ADMIN']}>
            <AdminLayout>
              <Routes>
                <Route path="/" element={<SystemAdminPage />} />
                <Route path="rbac" element={<RbacManagerPage />} />
                <Route path="backup" element={<BackupManagerPage />} />
                <Route path="ai-settings" element={<AiSettingsPage />} />
                <Route path="*" element={<Navigate to="/admin" replace />} />
              </Routes>
            </AdminLayout>
          </RequireAuth>
        } 
      />

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <AuthProvider>
      <CartProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </CartProvider>
    </AuthProvider>
  );
}

export default App;
