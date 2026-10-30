"use client";
import Link from "next/link";
import { AdminShellB } from "@/components/admin-b/admin-shell";
import { CustomerForm } from "@/components/admin-b/customer-form";
export default function AdminCustomerCreatePage() {
  return <AdminShellB active="customers" title="Tạo khách hàng" eyebrow="Vận hành · hồ sơ liên hệ"><div className="page-heading"><div><h1>Tạo khách hàng</h1><p className="meta">Hồ sơ khách hàng liên hệ · không tạo tài khoản đăng nhập</p></div><Link className="text-link" href="/quan-tri/khach-hang">← Danh sách</Link></div><section className="workbench"><CustomerForm mode="create" /></section></AdminShellB>;
}
