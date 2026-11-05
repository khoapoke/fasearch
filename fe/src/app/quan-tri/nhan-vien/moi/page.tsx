"use client";
import { useRouter } from "next/navigation";
import { AdminShellB } from "@/components/admin-b/admin-shell";
import { EmployeeForm } from "@/components/admin-b/employee-form";
export default function NewEmployeePage() { const router = useRouter(); return <AdminShellB active="employees" title="Tạo hồ sơ nhân sự" eyebrow="Hồ sơ nội bộ"><div className="page-heading"><div><h1>Tạo hồ sơ nhân sự</h1><p className="meta">Tạo hồ sơ trước hoặc sau khi tạo tài khoản nội bộ; liên kết là tùy chọn.</p></div></div><section className="workbench"><EmployeeForm mode="create" onSaved={(e) => router.push(`/quan-tri/nhan-vien/${e.id}`)} onCancel={() => router.push("/quan-tri/nhan-vien")} /></section></AdminShellB>; }
