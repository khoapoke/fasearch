"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { AdminShellB } from "@/components/admin-b/admin-shell";
import { CustomerForm } from "@/components/admin-b/customer-form";
import { getCustomer, genderLabel, type Customer } from "@/lib/admin-customer-client";
export default function AdminCustomerDetailPage() {
  const { id } = useParams<{ id: string }>(); const [c, setC] = useState<Customer | null>(null); const [error, setError] = useState(""); const [loading, setLoading] = useState(true);
  useEffect(() => { const ctrl = new AbortController(); getCustomer(id, ctrl.signal).then(setC).catch((e) => { if (!ctrl.signal.aborted) setError(e instanceof Error ? e.message : "Không tải được khách hàng."); }).finally(() => { if (!ctrl.signal.aborted) setLoading(false); }); return () => ctrl.abort(); }, [id]);
  return <AdminShellB active="customers" title="Chi tiết khách hàng" eyebrow="Vận hành · hồ sơ liên hệ">
    <div className="page-heading"><div><h1>{c ? [c.firstName, c.lastName].filter(Boolean).join(" ") || c.lastName : "Chi tiết khách hàng"}</h1><p className="meta">{c ? `#${c.id} · ${genderLabel(c.gender)} · ${c.phoneNumber}` : "Dữ liệu thật từ BE"}</p></div><Link className="text-link" href="/quan-tri/khach-hang">← Danh sách</Link></div>
    {loading ? <p className="meta" role="status">Đang tải khách hàng…</p> : null}{error ? <div className="order-empty" role="alert"><strong>Không tải được khách hàng</strong><p>{error}</p><Link className="text-link" href="/quan-tri/khach-hang">Về danh sách</Link></div> : null}
    {c ? <section className="workbench"><h2>Thông tin liên hệ</h2><p className="meta">Hạng và điểm là dữ liệu BE chỉ đọc; không có quyền đổi từ màn hình này.</p><CustomerForm mode="edit" customer={c} /></section> : null}
  </AdminShellB>;
}
