package com.springboot.fasearch.modules.trash.repository;

import java.util.List;

import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.Repository;
import org.springframework.data.repository.query.Param;

import com.springboot.fasearch.modules.product.entity.Category;

/**
 * Đọc/ghi thùng rác bằng SQL gốc.
 *
 * <p>{@code @SQLRestriction("da_xoa = false")} ẩn mọi dòng đã xóa mềm khỏi JPA, nên danh sách
 * thùng rác và các phép đếm kiểm tra điều kiện xóa phải đọc thẳng bảng. Khôi phục là câu lệnh
 * cập nhật có điều kiện {@code da_xoa = true}, trả về số dòng đã đổi để tầng service kiểm tra.
 */
public interface TrashRepository extends Repository<Category, Long> {

    /* ------------------------------- Thùng rác ------------------------------- */

    @Query(value = """
            select s.ma_sp, s.ten_sp, s.trang_thai, s.publication_status, s.ngay_xoa, s.ly_do_xoa,
                   coalesce(
                       (select nullif(trim(concat(coalesce(nv.ho_nv, ''), ' ', coalesce(nv.ten_nv, ''))), '')
                          from nhan_vien nv where nv.ma_tk = s.nguoi_xoa order by nv.ma_nv limit 1),
                       (select nullif(trim(concat(coalesce(kh.ho_kh, ''), ' ', coalesce(kh.ten_kh, ''))), '')
                          from khach_hang kh where kh.ma_tk = s.nguoi_xoa order by kh.ma_kh limit 1),
                       (select k.ten_dang_nhap from tai_khoan k where k.ma_tk = s.nguoi_xoa)
                   ) as nguoi_xoa_ten
            from san_pham s
            where s.da_xoa = true
            order by s.ngay_xoa desc nulls last, s.ma_sp desc
            limit :size offset :offset
            """, nativeQuery = true)
    List<Object[]> findDeletedProducts(@Param("offset") int offset, @Param("size") int size);

    @Query(value = "select count(*) from san_pham s where s.da_xoa = true", nativeQuery = true)
    long countDeletedProducts();

    @Query(value = """
            select v.ma_sku, v.ma_sp, s.ten_sp, s.trang_thai, s.da_xoa as san_pham_da_xoa,
                   v.mau_sac, v.kich_co, v.ma_vach, v.ngay_xoa, v.ly_do_xoa,
                   coalesce(
                       (select nullif(trim(concat(coalesce(nv.ho_nv, ''), ' ', coalesce(nv.ten_nv, ''))), '')
                          from nhan_vien nv where nv.ma_tk = v.nguoi_xoa order by nv.ma_nv limit 1),
                       (select nullif(trim(concat(coalesce(kh.ho_kh, ''), ' ', coalesce(kh.ten_kh, ''))), '')
                          from khach_hang kh where kh.ma_tk = v.nguoi_xoa order by kh.ma_kh limit 1),
                       (select k.ten_dang_nhap from tai_khoan k where k.ma_tk = v.nguoi_xoa)
                   ) as nguoi_xoa_ten
            from bien_the_sp v
            join san_pham s on s.ma_sp = v.ma_sp
            where v.da_xoa = true
            order by v.ngay_xoa desc nulls last, v.ma_sku desc
            limit :size offset :offset
            """, nativeQuery = true)
    List<Object[]> findDeletedVariants(@Param("offset") int offset, @Param("size") int size);

    @Query(value = "select count(*) from bien_the_sp v where v.da_xoa = true", nativeQuery = true)
    long countDeletedVariants();

    @Query(value = """
            select c.ma_danh_muc, c.ten_danh_muc, c.ngay_xoa, c.ly_do_xoa,
                   coalesce(
                       (select nullif(trim(concat(coalesce(nv.ho_nv, ''), ' ', coalesce(nv.ten_nv, ''))), '')
                          from nhan_vien nv where nv.ma_tk = c.nguoi_xoa order by nv.ma_nv limit 1),
                       (select nullif(trim(concat(coalesce(kh.ho_kh, ''), ' ', coalesce(kh.ten_kh, ''))), '')
                          from khach_hang kh where kh.ma_tk = c.nguoi_xoa order by kh.ma_kh limit 1),
                       (select k.ten_dang_nhap from tai_khoan k where k.ma_tk = c.nguoi_xoa)
                   ) as nguoi_xoa_ten
            from danh_muc c
            where c.da_xoa = true
            order by c.ngay_xoa desc nulls last, c.ma_danh_muc desc
            limit :size offset :offset
            """, nativeQuery = true)
    List<Object[]> findDeletedCategories(@Param("offset") int offset, @Param("size") int size);

    @Query(value = "select count(*) from danh_muc c where c.da_xoa = true", nativeQuery = true)
    long countDeletedCategories();

    @Query(value = "select count(*) from san_pham s where s.ma_sp = :productId and s.da_xoa = true", nativeQuery = true)
    long countDeletedProduct(@Param("productId") Long productId);

    @Query(value = "select count(*) from bien_the_sp v where v.ma_sku = :skuId and v.da_xoa = true", nativeQuery = true)
    long countDeletedVariant(@Param("skuId") Long skuId);

    @Query(value = "select count(*) from danh_muc c where c.ma_danh_muc = :categoryId and c.da_xoa = true", nativeQuery = true)
    long countDeletedCategory(@Param("categoryId") Long categoryId);

    /**
     * Khách hàng đã xóa: kèm trạng thái tài khoản đăng nhập liên kết (nếu có) để giao diện nói đúng
     * hệ quả khi khôi phục. Không đọc mật khẩu hay bất kỳ trường bí mật nào.
     */
    @Query(value = """
            select k.ma_kh, k.ho_kh, k.ten_kh, k.sdt, k.ngay_xoa, k.ly_do_xoa,
                   coalesce(
                       (select nullif(trim(concat(coalesce(nv.ho_nv, ''), ' ', coalesce(nv.ten_nv, ''))), '')
                          from nhan_vien nv where nv.ma_tk = k.nguoi_xoa order by nv.ma_nv limit 1),
                       (select nullif(trim(concat(coalesce(kh.ho_kh, ''), ' ', coalesce(kh.ten_kh, ''))), '')
                          from khach_hang kh where kh.ma_tk = k.nguoi_xoa order by kh.ma_kh limit 1),
                       (select t.ten_dang_nhap from tai_khoan t where t.ma_tk = k.nguoi_xoa)
                   ) as nguoi_xoa_ten,
                   t.ten_dang_nhap as ten_dang_nhap_lien_ket, t.trang_thai as trang_thai_tai_khoan
            from khach_hang k
            left join tai_khoan t on t.ma_tk = k.ma_tk
            where k.da_xoa = true
            order by k.ngay_xoa desc nulls last, k.ma_kh desc
            limit :size offset :offset
            """, nativeQuery = true)
    List<Object[]> findDeletedCustomers(@Param("offset") int offset, @Param("size") int size);

    @Query(value = "select count(*) from khach_hang k where k.da_xoa = true", nativeQuery = true)
    long countDeletedCustomers();

    @Query(value = """
            select n.ma_nv, n.ho_nv, n.ten_nv, n.sdt, n.ngay_xoa, n.ly_do_xoa,
                   coalesce(
                       (select nullif(trim(concat(coalesce(nv.ho_nv, ''), ' ', coalesce(nv.ten_nv, ''))), '')
                          from nhan_vien nv where nv.ma_tk = n.nguoi_xoa order by nv.ma_nv limit 1),
                       (select nullif(trim(concat(coalesce(kh.ho_kh, ''), ' ', coalesce(kh.ten_kh, ''))), '')
                          from khach_hang kh where kh.ma_tk = n.nguoi_xoa order by kh.ma_kh limit 1),
                       (select t.ten_dang_nhap from tai_khoan t where t.ma_tk = n.nguoi_xoa)
                   ) as nguoi_xoa_ten,
                   t.ten_dang_nhap as ten_dang_nhap_lien_ket, t.trang_thai as trang_thai_tai_khoan
            from nhan_vien n
            left join tai_khoan t on t.ma_tk = n.ma_tk
            where n.da_xoa = true
            order by n.ngay_xoa desc nulls last, n.ma_nv desc
            limit :size offset :offset
            """, nativeQuery = true)
    List<Object[]> findDeletedEmployees(@Param("offset") int offset, @Param("size") int size);

    @Query(value = "select count(*) from nhan_vien n where n.da_xoa = true", nativeQuery = true)
    long countDeletedEmployees();

    @Query(value = """
            select t.ma_tk, t.ten_dang_nhap, t.email, r.ten_vai_tro, t.trang_thai, t.ngay_xoa, t.ly_do_xoa,
                   coalesce(
                       (select nullif(trim(concat(coalesce(nv.ho_nv, ''), ' ', coalesce(nv.ten_nv, ''))), '')
                          from nhan_vien nv where nv.ma_tk = t.nguoi_xoa order by nv.ma_nv limit 1),
                       (select nullif(trim(concat(coalesce(kh.ho_kh, ''), ' ', coalesce(kh.ten_kh, ''))), '')
                          from khach_hang kh where kh.ma_tk = t.nguoi_xoa order by kh.ma_kh limit 1),
                       (select a.ten_dang_nhap from tai_khoan a where a.ma_tk = t.nguoi_xoa)
                   ) as nguoi_xoa_ten
            from tai_khoan t
            left join vai_tro r on r.ma_vai_tro = t.ma_vai_tro
            where t.da_xoa = true
            order by t.ngay_xoa desc nulls last, t.ma_tk desc
            limit :size offset :offset
            """, nativeQuery = true)
    List<Object[]> findDeletedAccounts(@Param("offset") int offset, @Param("size") int size);

    @Query(value = "select count(*) from tai_khoan t where t.da_xoa = true", nativeQuery = true)
    long countDeletedAccounts();

    @Query(value = "select count(*) from khach_hang k where k.ma_kh = :customerId and k.da_xoa = true", nativeQuery = true)
    long countDeletedCustomer(@Param("customerId") Long customerId);

    @Query(value = "select count(*) from nhan_vien n where n.ma_nv = :employeeId and n.da_xoa = true", nativeQuery = true)
    long countDeletedEmployee(@Param("employeeId") Long employeeId);

    @Query(value = "select count(*) from tai_khoan t where t.ma_tk = :accountId and t.da_xoa = true", nativeQuery = true)
    long countDeletedAccount(@Param("accountId") Long accountId);

    /* ------------------------- Kiểm tra trước khi xóa ------------------------- */

    @Query(value = """
            select count(*) from ct_don_hang c
            join bien_the_sp v on v.ma_sku = c.ma_sku
            where v.ma_sp = :productId
            """, nativeQuery = true)
    long countOrderLinesForProduct(@Param("productId") Long productId);

    @Query(value = "select count(*) from ct_don_hang where ma_sku = :skuId", nativeQuery = true)
    long countOrderLinesForVariant(@Param("skuId") Long skuId);

    @Query(value = """
            select count(*) from ton_kho t
            join bien_the_sp v on v.ma_sku = t.ma_sku
            where v.ma_sp = :productId and (t.so_luong_vat_ly > 0 or t.so_luong_tam_giu > 0)
            """, nativeQuery = true)
    long countStockForProduct(@Param("productId") Long productId);

    @Query(value = """
            select count(*) from ton_kho
            where ma_sku = :skuId and (so_luong_vat_ly > 0 or so_luong_tam_giu > 0)
            """, nativeQuery = true)
    long countStockForVariant(@Param("skuId") Long skuId);

    @Query(value = """
            select count(*) from ct_phieu_nhap c
            join bien_the_sp v on v.ma_sku = c.ma_sku
            where v.ma_sp = :productId
            """, nativeQuery = true)
    long countImportLinesForProduct(@Param("productId") Long productId);

    @Query(value = "select count(*) from ct_phieu_nhap where ma_sku = :skuId", nativeQuery = true)
    long countImportLinesForVariant(@Param("skuId") Long skuId);

    @Query(value = """
            select count(*) from ct_phieu_xuat c
            join bien_the_sp v on v.ma_sku = c.ma_sku
            where v.ma_sp = :productId
            """, nativeQuery = true)
    long countExportLinesForProduct(@Param("productId") Long productId);

    @Query(value = "select count(*) from ct_phieu_xuat where ma_sku = :skuId", nativeQuery = true)
    long countExportLinesForVariant(@Param("skuId") Long skuId);

    @Query(value = """
            select count(*) from ct_phieu_kiem_ke c
            join bien_the_sp v on v.ma_sku = c.ma_sku
            where v.ma_sp = :productId
            """, nativeQuery = true)
    long countStocktakeLinesForProduct(@Param("productId") Long productId);

    @Query(value = "select count(*) from ct_phieu_kiem_ke where ma_sku = :skuId", nativeQuery = true)
    long countStocktakeLinesForVariant(@Param("skuId") Long skuId);

    @Query(value = "select count(*) from khuyen_mai_san_pham where ma_sp = :productId", nativeQuery = true)
    long countPromotionEntriesForProduct(@Param("productId") Long productId);

    @Query(value = """
            select count(*) from khuyen_mai_san_pham ks
            join bien_the_sp v on v.ma_sp = ks.ma_sp
            where v.ma_sku = :skuId
            """, nativeQuery = true)
    long countPromotionEntriesForVariant(@Param("skuId") Long skuId);

    /** Đếm cả sản phẩm đã xóa mềm: danh mục còn tham chiếu thì không xóa được. */
    @Query(value = "select count(*) from san_pham where ma_danh_muc = :categoryId", nativeQuery = true)
    long countProductsInCategory(@Param("categoryId") Long categoryId);

    @Query(value = "select count(*) from don_hang where ma_kh = :customerId", nativeQuery = true)
    long countOrdersForCustomer(@Param("customerId") Long customerId);

    @Query(value = """
            select count(*) from hoa_don i
            join don_hang d on d.ma_don_hang = i.ma_don_hang
            where d.ma_kh = :customerId
            """, nativeQuery = true)
    long countInvoicesForCustomer(@Param("customerId") Long customerId);

    @Query(value = "select count(*) from loyalty_ledger_entry where customer_id = :customerId", nativeQuery = true)
    long countLedgerEntriesForCustomer(@Param("customerId") Long customerId);

    @Query(value = "select count(*) from phieu_doi_tra where ma_kh = :customerId", nativeQuery = true)
    long countReturnsForCustomer(@Param("customerId") Long customerId);

    @Query(value = "select count(*) from nhan_vien where ma_tk = :accountId", nativeQuery = true)
    long countEmployeeProfilesForAccount(@Param("accountId") Long accountId);

    @Query(value = "select count(*) from khach_hang where ma_tk = :accountId", nativeQuery = true)
    long countCustomerProfilesForAccount(@Param("accountId") Long accountId);

    /** Hồ sơ còn hoạt động gắn với tài khoản: khôi phục tài khoản lúc này sẽ tạo hồ sơ trùng chủ. */
    @Query(value = """
            select count(*) from nhan_vien n where n.ma_tk = :accountId and n.da_xoa = false
            """, nativeQuery = true)
    long countLiveEmployeeProfilesForAccount(@Param("accountId") Long accountId);

    @Query(value = """
            select count(*) from khach_hang k where k.ma_tk = :accountId and k.da_xoa = false
            """, nativeQuery = true)
    long countLiveCustomerProfilesForAccount(@Param("accountId") Long accountId);

    /** Tài khoản đăng nhập của hồ sơ đã bị xóa: hồ sơ chỉ khôi phục được sau khi khôi phục tài khoản. */
    @Query(value = """
            select count(*) from khach_hang k join tai_khoan t on t.ma_tk = k.ma_tk
            where k.ma_kh = :customerId and t.da_xoa = true
            """, nativeQuery = true)
    long countDeletedAccountOfCustomer(@Param("customerId") Long customerId);

    @Query(value = """
            select count(*) from nhan_vien n join tai_khoan t on t.ma_tk = n.ma_tk
            where n.ma_nv = :employeeId and t.da_xoa = true
            """, nativeQuery = true)
    long countDeletedAccountOfEmployee(@Param("employeeId") Long employeeId);

    /** Hồ sơ nhân sự liên kết tài khoản Quản trị viên (kể cả tài khoản đang khóa): chỉ ADMIN được khôi phục. */
    @Query(value = """
            select count(*) from nhan_vien n
            join tai_khoan t on t.ma_tk = n.ma_tk
            join vai_tro r on r.ma_vai_tro = t.ma_vai_tro
            where n.ma_nv = :employeeId and r.ten_vai_tro = 'ADMIN'
            """, nativeQuery = true)
    long countAdminLinkedEmployee(@Param("employeeId") Long employeeId);

    @Query(value = """
            select count(*) from tai_khoan a
            join vai_tro r on r.ma_vai_tro = a.ma_vai_tro
            where r.ten_vai_tro = 'ADMIN' and a.trang_thai = 'ACTIVE' and a.da_xoa = false
            """, nativeQuery = true)
    long countActiveAdmins();

    @Query(value = """
            select count(*) from tai_khoan a
            join vai_tro r on r.ma_vai_tro = a.ma_vai_tro
            where a.ma_tk = :accountId and r.ten_vai_tro = 'ADMIN'
              and a.trang_thai = 'ACTIVE' and a.da_xoa = false
            """, nativeQuery = true)
    long countActiveAdminAccount(@Param("accountId") Long accountId);

    /* ---------------------- Kiểm tra trùng trước khi khôi phục ---------------------- */

    @Query(value = """
            select count(*) from san_pham p
            where p.da_xoa = false and p.ma_sp <> :productId
              and p.model_code is not null and p.ma_thuong_hieu is not null
              and exists (select 1 from san_pham t
                          where t.ma_sp = :productId
                            and t.model_code = p.model_code
                            and t.ma_thuong_hieu = p.ma_thuong_hieu)
            """, nativeQuery = true)
    long countSameBrandModelProducts(@Param("productId") Long productId);

    @Query(value = """
            select count(*) from bien_the_sp v
            where v.ma_sp = :productId and v.ma_vach is not null
              and v.da_xoa = true
              and v.ngay_xoa is not distinct from (select p.ngay_xoa from san_pham p where p.ma_sp = :productId)
              and exists (select 1 from bien_the_sp o
                          where o.da_xoa = false and o.ma_vach = v.ma_vach)
            """, nativeQuery = true)
    long countVariantBarcodeConflictsInProduct(@Param("productId") Long productId);

    @Query(value = """
            select count(*) from bien_the_sp o
            where o.da_xoa = false and o.ma_sku <> :skuId and o.ma_vach is not null
              and o.ma_vach = (select v.ma_vach from bien_the_sp v where v.ma_sku = :skuId)
            """, nativeQuery = true)
    long countVariantBarcodeConflicts(@Param("skuId") Long skuId);

    @Query(value = """
            select count(*) from bien_the_sp o
            where o.da_xoa = false and o.ma_sku <> :skuId
              and exists (select 1 from bien_the_sp v
                          where v.ma_sku = :skuId and o.ma_sp = v.ma_sp
                            and lower(coalesce(o.mau_sac, '')) = lower(coalesce(v.mau_sac, ''))
                            and lower(coalesce(o.kich_co, '')) = lower(coalesce(v.kich_co, '')))
            """, nativeQuery = true)
    long countVariantSiblingConflicts(@Param("skuId") Long skuId);

    @Query(value = """
            select count(*) from bien_the_sp v join san_pham s on s.ma_sp = v.ma_sp
            where v.ma_sku = :skuId and s.da_xoa = true
            """, nativeQuery = true)
    long countDeletedProductOfVariant(@Param("skuId") Long skuId);

    @Query(value = """
            select count(*) from danh_muc c
            where c.da_xoa = false and c.ma_danh_muc <> :categoryId
              and lower(btrim(regexp_replace(c.ten_danh_muc, '\\s+', ' ', 'g'))) =
                  (select lower(btrim(regexp_replace(t.ten_danh_muc, '\\s+', ' ', 'g'))) from danh_muc t where t.ma_danh_muc = :categoryId)
            """, nativeQuery = true)
    long countCategoryNameConflicts(@Param("categoryId") Long categoryId);

    /* -------------------------------- Khôi phục -------------------------------- */

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query(value = """
            update san_pham
               set da_xoa = false, ngay_xoa = null, nguoi_xoa = null, ly_do_xoa = null,
                   trang_thai = 'DISCONTINUED', publication_status = 'UNPUBLISHED'
             where ma_sp = :productId and da_xoa = true
            """, nativeQuery = true)
    int restoreProduct(@Param("productId") Long productId);

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query(value = """
            update bien_the_sp
               set da_xoa = false, ngay_xoa = null, nguoi_xoa = null, ly_do_xoa = null
             where ma_sp = :productId and da_xoa = true
               and ngay_xoa is not distinct from (select p.ngay_xoa from san_pham p where p.ma_sp = :productId and p.da_xoa = true)
            """, nativeQuery = true)
    int restoreVariantsOfProduct(@Param("productId") Long productId);

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query(value = """
            update bien_the_sp
               set da_xoa = false, ngay_xoa = null, nguoi_xoa = null, ly_do_xoa = null
             where ma_sku = :skuId and da_xoa = true
            """, nativeQuery = true)
    int restoreVariant(@Param("skuId") Long skuId);

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query(value = """
            update danh_muc
               set da_xoa = false, ngay_xoa = null, nguoi_xoa = null, ly_do_xoa = null
             where ma_danh_muc = :categoryId and da_xoa = true
            """, nativeQuery = true)
    int restoreCategory(@Param("categoryId") Long categoryId);

    /* -------------- Trùng khóa duy nhất khi khôi phục hồ sơ / tài khoản -------------- */

    @Query(value = """
            select count(*) from khach_hang k
            where k.da_xoa = false and k.ma_kh <> :customerId and k.sdt is not null
              and k.sdt = (select t.sdt from khach_hang t where t.ma_kh = :customerId)
            """, nativeQuery = true)
    long countCustomerPhoneConflicts(@Param("customerId") Long customerId);

    @Query(value = """
            select count(*) from nhan_vien n
            where n.da_xoa = false and n.ma_nv <> :employeeId and n.sdt is not null
              and n.sdt = (select t.sdt from nhan_vien t where t.ma_nv = :employeeId)
            """, nativeQuery = true)
    long countEmployeePhoneConflicts(@Param("employeeId") Long employeeId);

    @Query(value = """
            select count(*) from nhan_vien n
            where n.da_xoa = false and n.ma_nv <> :employeeId and n.cccd is not null
              and n.cccd = (select t.cccd from nhan_vien t where t.ma_nv = :employeeId)
            """, nativeQuery = true)
    long countEmployeeCccdConflicts(@Param("employeeId") Long employeeId);

    @Query(value = """
            select count(*) from tai_khoan t
            where t.da_xoa = false and t.ma_tk <> :accountId and t.ten_dang_nhap is not null
              and lower(t.ten_dang_nhap) =
                  (select lower(a.ten_dang_nhap) from tai_khoan a where a.ma_tk = :accountId)
            """, nativeQuery = true)
    long countAccountUsernameConflicts(@Param("accountId") Long accountId);

    @Query(value = """
            select count(*) from tai_khoan t
            where t.da_xoa = false and t.ma_tk <> :accountId and t.email is not null
              and lower(t.email) = (select lower(a.email) from tai_khoan a where a.ma_tk = :accountId)
            """, nativeQuery = true)
    long countAccountEmailConflicts(@Param("accountId") Long accountId);

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query(value = """
            update khach_hang
               set da_xoa = false, ngay_xoa = null, nguoi_xoa = null, ly_do_xoa = null
             where ma_kh = :customerId and da_xoa = true
            """, nativeQuery = true)
    int restoreCustomer(@Param("customerId") Long customerId);

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query(value = """
            update nhan_vien
               set da_xoa = false, ngay_xoa = null, nguoi_xoa = null, ly_do_xoa = null
             where ma_nv = :employeeId and da_xoa = true
            """, nativeQuery = true)
    int restoreEmployee(@Param("employeeId") Long employeeId);

    /**
     * Tài khoản khôi phục về INACTIVE để ADMIN phải chủ động bật lại; token_version tăng để mọi
     * token cấp trước khi xóa không thể sống lại khi tài khoản được bật.
     */
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query(value = """
            update tai_khoan
               set da_xoa = false, ngay_xoa = null, nguoi_xoa = null, ly_do_xoa = null,
                   trang_thai = 'INACTIVE', token_version = coalesce(token_version, 0) + 1
             where ma_tk = :accountId and da_xoa = true
            """, nativeQuery = true)
    int restoreAccount(@Param("accountId") Long accountId);
}
