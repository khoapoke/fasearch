"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { AdminShellB } from "@/components/admin-b/admin-shell";
import { getEmployeePage, maskCccd, roleLabel, type Employee, type Page } from "@/lib/admin-people-client";
export default function EmployeesPage() {
  const [data, setData] = useState<Page<Employee> | null>(null); const [page, setPage] = useState(0); const [keyword, setKeyword] = useState(""); const [loading, setLoading] = useState(true); const [error, setError] = useState("");
  async function load(next = page, clear = false) { setLoading(true); setError(""); const q = new URLSearchParams({ page: String(next), size: "5" }); if (!clear && keyword.trim()) q.set("keyword", keyword.trim()); try { setData(await getEmployeePage(q.toString())); } catch (e) { setError(e instanceof Error ? e.message : "Không tải được nhân viên."); } finally { setLoading(false); } }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { void Promise.resolve().then(() => load(0)); }, []);
  return <AdminShellB active="employees" title="Nhân viên" eyebrow="Vận hành · hồ sơ nội bộ · ADMIN">
    <div className="page-heading"><div><h1>Nhân viên</h1><p className="meta">Hồ sơ nhân sự · CCCD che ở danh sách · tài khoản liên kết không bắt buộc · không xóa</p></div><Link className="primary" href="/quan-tri/nhan-vien/moi">Tạo nhân viên</Link></div>
    <form className="stock-filters" onSubmit={(e) => { e.preventDefault(); setPage(0); void load(0); }}><div className="catalog-field"><label htmlFor="emp-search">Tìm họ tên / SĐT / CCCD</label><input id="emp-search" className="catalog-input" maxLength={100} value={keyword} onChange={(e) => setKeyword(e.target.value)} /></div><button className="primary" type="submit">Tìm</button><button className="text-link" type="button" onClick={() => { setKeyword(""); setPage(0); void load(0, true); }}>Đặt lại</button></form>
    {loading ? <p className="meta" role="status">Đang tải nhân viên…</p> : null}{error ? <div className="order-empty" role="alert"><strong>Không tải được nhân viên</strong><p>{error}</p><button className="text-link" type="button" onClick={() => load(page)}>Thử lại</button></div> : null}
    {!loading && !error && data?.content.length === 0 ? <div className="order-empty"><strong>Không có nhân viên khớp</strong><p>Thử từ khóa khác.</p></div> : null}
    {data && data.content.length > 0 ? <div className="table-scroll review-table-scroll" tabIndex={0} aria-label="Danh sách nhân viên"><table className="review-orders-table"><caption>{data.totalElements} nhân viên · trang {data.pageNumber + 1}/{Math.max(1, data.totalPages)}</caption><thead><tr><th>ID</th><th>Họ tên</th><th>SĐT</th><th>CCCD</th><th>Tài khoản</th><th>Vai trò</th><th>Thao tác</th></tr></thead><tbody>{data.content.map((e) => <tr key={e.id}><td>{e.id}</td><td>{[e.firstName, e.lastName].filter(Boolean).join(" ") || `Nhân viên #${e.id}`}</td><td>{e.phoneNumber}</td><td className="people-mask">{maskCccd(e.cccd)}</td><td>{e.username ? `#${e.accountId} ${e.username}` : "Chưa liên kết"}</td><td>{roleLabel(e.role)}</td><td><Link className="text-link" href={`/quan-tri/nhan-vien/${e.id}`}>Chi tiết</Link></td></tr>)}</tbody></table></div> : null}
    {data && data.totalPages > 1 ? <div className="review-summary"><button className="text-link" disabled={page === 0} onClick={() => { setPage(page - 1); void load(page - 1); }}>← Trước</button><span>Trang {page + 1} · {data.totalElements}</span><button className="text-link" disabled={data.last} onClick={() => { setPage(page + 1); void load(page + 1); }}>Sau →</button></div> : null}
  </AdminShellB>;
}
