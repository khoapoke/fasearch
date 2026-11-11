"use client";
import { useEffect, useMemo, useState } from "react";
import { AdminShellB } from "@/components/admin-b/admin-shell";
import { Pager } from "@/components/admin-b/pagination";
import { useAdminCan } from "@/components/admin-b/use-admin-role";
import { createCategory, deleteCategory, getCategories, updateCategory, type Category } from "@/lib/admin-catalog-client";
import { AdminModal } from "@/components/admin-b/modal";
import { PageHeader } from "@/components/admin-b/page-header";
import { useToast } from "@/components/admin-b/toast";
import { DeleteReasonPanel } from "@/components/admin-b/delete-reason-panel";
import { Skeleton } from "@/components/admin-b/skeleton";
import "@/components/admin-b/h2.css";
// 30 per page: a 3-column grid of 10 rows fits a 1440x900 screen without scrolling.
const PAGE_SIZE = 30;
export default function AdminCategoriesPage() {
  const can = useAdminCan();
  const toast = useToast();
  const [rows, setRows] = useState<Category[]>([]); const [loading, setLoading] = useState(true); const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState<{ mode: "create" } | { mode: "edit"; id: number } | null>(null); const [formName, setFormName] = useState(""); const [formError, setFormError] = useState("");
  const [search, setSearch] = useState(""); const [page, setPage] = useState(0);
  const [deleteTarget, setDeleteTarget] = useState<Category | null>(null); const [deleteIssue, setDeleteIssue] = useState(""); const [deleteBusy, setDeleteBusy] = useState(false);
  async function load() { setLoading(true); setError(""); try { setRows(await getCategories()); } catch (e) { setError(e instanceof Error ? e.message : "Không tải được danh mục."); } finally { setLoading(false); } }
  useEffect(() => { const c = new AbortController(); getCategories(c.signal).then(setRows).catch((e) => { if (!c.signal.aborted) setError(e instanceof Error ? e.message : "Không tải được danh mục."); }).finally(() => { if (!c.signal.aborted) setLoading(false); }); return () => c.abort(); }, []);
  function openCreate() { setFormName(""); setFormError(""); setForm({ mode: "create" }); }
  function openEdit(c: Category) { setFormName(c.categoryName); setFormError(""); setForm({ mode: "edit", id: c.id }); }
  function closeForm() { if (!busy) { setForm(null); setFormError(""); } }
  async function submitForm(e: React.FormEvent) {
    e.preventDefault(); if (busy || !form) return;
    const trimmed = formName.trim();
    if (!trimmed) { setFormError("Nhập tên danh mục."); return; }
    setBusy(true); setFormError("");
    try {
      if (form.mode === "create") await createCategory(trimmed); else await updateCategory(form.id, trimmed);
      toast.success(form.mode === "create" ? `Đã tạo danh mục "${trimmed}". Danh sách đang lọc để bạn thấy ngay.` : "Đã lưu danh mục.");
      if (form.mode === "create") { setSearch(trimmed); setPage(0); }
      setForm(null);
      await load();
    } catch (err) {
      const message = err instanceof Error && err.message ? err.message : form.mode === "create" ? "Không tạo được danh mục." : "Không sửa được danh mục.";
      setFormError(message);
    } finally { setBusy(false); }
  }
  async function remove(reason: string) { if (!deleteTarget || deleteBusy) return; setDeleteBusy(true); setDeleteIssue(""); try { await deleteCategory(deleteTarget.id, reason); setDeleteTarget(null); toast.success("Đã chuyển danh mục vào thùng rác."); await load(); } catch (e) { setDeleteIssue(e instanceof Error && e.message ? e.message : "Không xóa được danh mục."); } finally { setDeleteBusy(false); } }
  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return needle ? rows.filter((c) => c.categoryName.toLowerCase().includes(needle)) : rows;
  }, [rows, search]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const current = Math.min(page, totalPages - 1);
  const pageRows = filtered.slice(current * PAGE_SIZE, current * PAGE_SIZE + PAGE_SIZE);
  const manage = can("CATEGORY_MANAGE");
  return <AdminShellB active="categories" title="Danh mục" eyebrow="Vận hành · danh mục sản phẩm">
    <PageHeader title="Danh mục"
      hint={manage ? "Tên danh mục không được trùng. Xóa đưa danh mục vào thùng rác và khôi phục được; danh mục còn sản phẩm tham chiếu (kể cả sản phẩm đã xóa) sẽ bị từ chối." : "Tài khoản hiện tại chỉ đọc."}
      actions={manage ? <button className="primary" type="button" onClick={openCreate}>Tạo danh mục</button> : null} />
    {error ? <div className="catalog-error" role="alert"><p>{error}</p><button className="secondary" type="button" onClick={() => void load()}>Thử lại</button></div> : null}
    <DeleteReasonPanel open={deleteTarget !== null} title="Xóa danh mục này?" target={deleteTarget?.categoryName ?? ""} consequence="Danh mục sẽ được ẩn khỏi vận hành và chuyển vào thùng rác; dữ liệu không bị xóa vĩnh viễn và có thể khôi phục ở mục Thùng rác. Danh mục còn sản phẩm tham chiếu (kể cả sản phẩm đã xóa) sẽ bị từ chối." busy={deleteBusy} refusal={deleteIssue} onClose={() => { if (!deleteBusy) { setDeleteTarget(null); setDeleteIssue(""); } }} onConfirm={(reason) => void remove(reason)} />
    <AdminModal open={form !== null} title={form?.mode === "edit" ? "Sửa danh mục" : "Tạo danh mục"} size="sm" busy={busy} onClose={closeForm}
      footer={<><button className="secondary" type="button" disabled={busy} onClick={closeForm}>Hủy</button><button className="primary" type="submit" form="category-form" disabled={busy}>{busy ? "Đang lưu…" : "Lưu"}</button></>}>
      <form id="category-form" className="catalog-form" onSubmit={submitForm} noValidate>
        <div className="catalog-field"><label htmlFor="category-name">Tên danh mục</label><input id="category-name" className="catalog-input" value={formName} maxLength={150} autoFocus onChange={(e) => { setFormName(e.target.value); if (formError) setFormError(""); }} aria-invalid={formError ? true : undefined} aria-describedby={formError ? "category-error" : undefined} /><p className="pf-count">{formName.length}/150 ký tự</p></div>
        {formError ? <p className="catalog-error" id="category-error" role="alert">{formError}</p> : null}
      </form>
    </AdminModal>
    <div className="h2-toolbar">
      <div className="catalog-field live-search-field h2-search"><label htmlFor="category-search">Tìm danh mục</label><div className="live-search-control"><input id="category-search" type="search" className="catalog-input" maxLength={150} placeholder="Tìm danh mục" value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }} />{search ? <button className="live-search-clear" type="button" onClick={() => { setSearch(""); setPage(0); }} aria-label="Xóa từ khóa">Xóa</button> : null}</div></div>
      {filtered.length > 0 ? <Pager page={current} totalPages={totalPages} total={filtered.length} unit="danh mục" onPage={setPage} /> : null}
    </div>
    {loading && rows.length === 0 ? <div className="h2-cat-grid" role="status" aria-label="Đang tải dữ liệu">{Array.from({ length: 9 }, (_, i) => <div className="h2-cat-skel" key={i}><Skeleton width="100%" height={52} radius={8} /></div>)}</div> : null}
    {!loading && !error && rows.length === 0 ? <div className="order-empty"><strong>Chưa có danh mục</strong><p>Tạo danh mục đầu tiên để gán cho sản phẩm.</p></div> : null}
    {!loading && rows.length > 0 && filtered.length === 0 ? <div className="order-empty"><strong>Không có danh mục khớp</strong><p>Thử từ khóa khác.</p></div> : null}
    {pageRows.length > 0 ? <ul className="h2-cat-grid" aria-label="Danh sách danh mục">{pageRows.map((c) => <li className="h2-cat-card" key={c.id}>
      <div className="h2-cat-row">
        <span className="h2-cat-name" title={c.categoryName}>{c.categoryName}</span>
        {manage ? <div className="h2-cat-actions"><button className="secondary btn-sm" type="button" aria-label={`Sửa ${c.categoryName}`} onClick={() => openEdit(c)}>Sửa</button><button className="danger btn-sm" type="button" aria-label={`Xóa ${c.categoryName}`} onClick={() => { setDeleteIssue(""); setDeleteTarget(c); }}>Xóa</button></div> : <span className="meta">Chỉ đọc</span>}
      </div>
    </li>)}</ul> : null}
  </AdminShellB>;
}
