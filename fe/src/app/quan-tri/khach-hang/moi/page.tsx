"use client";
import Link from "next/link";
import { AdminShellB } from "@/components/admin-b/admin-shell";
import { CustomerForm } from "@/components/admin-b/customer-form";
import { InfoHint } from "@/components/admin-b/info-hint";
export default function AdminCustomerCreatePage() {
  return <AdminShellB active="customers" title="Tạo khách hàng"><div className="page-head pd-head"><div className="page-head-title"><div className="l3-title-stack"><Link className="back-link" href="/quan-tri/khach-hang">← Khách hàng</Link><h1>Tạo khách hàng</h1></div></div></div><div className="form-layout"><div className="form-main"><section className="form-card"><h2 className="l3-card-title">Thông tin liên hệ <InfoHint>Hồ sơ liên hệ không tạo tài khoản đăng nhập. Hạng và điểm do hệ thống tính.</InfoHint></h2><CustomerForm mode="create" /></section></div></div></AdminShellB>;
}
