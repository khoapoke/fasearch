"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { AdminShellB } from "@/components/admin-b/admin-shell";
import { useAdminRole } from "@/components/admin-b/use-admin-role";
import { getCustomerPage, genderLabel, type Customer, type Page } from "@/lib/admin-customer-client";
export default function AdminCustomersPage() {
  const role = useAdminRole(); const [data, setData] = useState<Page<Customer> | null>(null); const [page, setPage] = useState(0); const [keyword, setKeyword] = useState(""); const [loading, setLoading] = useState(true); const [error, setError] = useState("");
  async function load(next = page, clear = false) { setLoading(true); setError(""); const q = new URLSearchParams({ page: String(next), size: "10" }); if (!clear && keyword.trim()) q.set("keyword", keyword.trim()); try { setData(await getCustomerPage(q.toString())); } catch (e) { setError(e instanceof Error ? e.message : "Không tải được khách hàng."); } finally { setLoading(false); } }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { void Promise.resolve().then(() => load(0)); }, []);
  const canWrite = role === "ADMIN" || role === "STAFF";
  return <AdminShellB active="customers" title="Khách hàng" eyebrow="Vận hành · hồ sơ khách hàng">
    <div className="page-heading"><div><h1>Khách hàng</h1><p className="meta">Hồ sơ liên hệ thật từ BE · hạng/điểm chỉ đọc · {canWrite ? "ADMIN và STAFF có thể tạo/sửa" : "đang kiểm tra quyền"}</p></div>{canWrite ? <Link className="primary" href="/quan-tri/khach-hang/moi">Tạo khách hàng</Link> : null}</div>
    <form className="stock-filters" onSubmit={(e) => { e.preventDefault(); setPage(0); void load(0); }}><div className="catalog-field"><label htmlFor="cust-search">Tìm theo tên / SĐT</label><input id="cust-search" className="catalog-input" maxLength={100} value={keyword} onChange={(e) => setKeyword(e.target.value)} /></div><button className="primary" type="submit">Tìm</button><button className="text-link" type="button" onClick={() => { setKeyword(""); setPage(0); void load(0, true); }}>Đặt lại</button></form>
    {loading ? <p className="meta" role="status">Đang tải khách hàng…</p> : null}{error ? <div className="order-empty" role="alert"><strong>Không tải được khách hàng</strong><p>{error}</p><button className="text-link" type="button" onClick={() => load(page)}>Thử lại</button></div> : null}
    {!loading && !error && data?.content.length === 0 ? <div className="order-empty"><strong>Không có khách hàng khớp</strong><p>Thử từ khóa khác.</p></div> : null}
    {data && data.content.length > 0 ? <div className="table-scroll review-table-scroll" tabIndex={0} aria-label="Danh sách khách hàng"><table className="review-orders-table"><caption>{data.totalElements} khách hàng · trang {data.pageNumber + 1}/{Math.max(1, data.totalPages)} · hạng/điểm chỉ đọc</caption><thead><tr><th>ID</th><th>Khách hàng</th><th>Số điện thoại</th><th>Giới tính</th><th>Địa chỉ</th><th>Hạng / điểm</th></tr></thead><tbody>{data.content.map((c) => <tr key={c.id}><td>{c.id}</td><td><Link className="text-link" href={`/quan-tri/khach-hang/${c.id}`}>{[c.firstName, c.lastName].filter(Boolean).join(" ") || c.lastName}</Link></td><td>{c.phoneNumber}</td><td>{genderLabel(c.gender)}</td><td>{c.address ?? "—"}</td><td>{c.tierName ?? "—"} · {c.accumulatePoint ?? 0}</td></tr>)}</tbody></table></div> : null}
    {data && data.totalPages > 1 ? <div className="review-summary"><button className="text-link" disabled={page === 0} onClick={() => { setPage(page - 1); void load(page - 1); }}>← Trước</button><span>Trang {page + 1} · {data.totalElements}</span><button className="text-link" disabled={data.last} onClick={() => { setPage(page + 1); void load(page + 1); }}>Sau →</button></div> : null}
    <p className="meta" style={{ marginTop: 16 }}>Không có xóa khách hàng, đổi hạng/điểm, email hay quyền tài khoản. Tạo hồ sơ khách hàng không tạo tài khoản đăng nhập.</p>
  </AdminShellB>;
}
