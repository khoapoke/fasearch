package com.springboot.fasearch.modules.analytics.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.springboot.fasearch.modules.payment.entity.Invoice;

/**
 * Read-only reporting queries over existing paid snapshots. No writes, no schema change.
 * Revenue counts an invoice only when it is PAID, not soft-deleted, and its order is neither
 * DRAFT nor CANCELLED. COMPLETED status alone never implies payment.
 */
public interface AnalyticsReadRepository extends JpaRepository<Invoice, Long> {

    @Query(value = """
            select i.ma_hoa_don, i.ngay_lap, i.tong_tien_thuc_tra, i.ma_don_hang
            from hoa_don i join don_hang d on d.ma_don_hang = i.ma_don_hang
            where i.trang_thai = 'PAID' and i.da_xoa = false
              and d.da_xoa = false
              and d.trang_thai not in ('DRAFT', 'CANCELLED')
              and i.ngay_lap >= cast(:from as timestamp) and i.ngay_lap < cast(:to as timestamp)
            order by i.ngay_lap
            """, nativeQuery = true)
    List<Object[]> paidInvoicesInRange(@Param("from") String from, @Param("to") String to);

    @Query(value = """
            select count(*) from don_hang d
            where d.da_xoa = false and d.trang_thai = :status
              and d.ngay_dat >= cast(:from as timestamp) and d.ngay_dat < cast(:to as timestamp)
              and not exists (select 1 from hoa_don i where i.ma_don_hang = d.ma_don_hang
                              and i.trang_thai = 'PAID' and i.da_xoa = false)
            """, nativeQuery = true)
    long countUnpaidOrdersByStatus(@Param("status") String status, @Param("from") String from,
            @Param("to") String to);

    @Query(value = """
            select v.ma_sku, s.ma_sp, s.ten_sp, coalesce(dm.ten_danh_muc, ''),
                   v.mau_sac, v.kich_co, v.ma_vach,
                   coalesce(sum(case when i.trang_thai = 'PAID' and i.da_xoa = false
                        and d.da_xoa = false
                        and d.trang_thai not in ('DRAFT', 'CANCELLED')
                        and i.ngay_lap >= cast(:from as timestamp) and i.ngay_lap < cast(:to as timestamp)
                        then c.so_luong else 0 end), 0),
                   coalesce(sum(case when i.trang_thai = 'PAID' and i.da_xoa = false
                        and d.da_xoa = false
                        and d.trang_thai not in ('DRAFT', 'CANCELLED')
                        and i.ngay_lap >= cast(:from as timestamp) and i.ngay_lap < cast(:to as timestamp)
                        then c.so_luong * c.don_gia else 0 end), 0),
                   max(case when s.da_xoa then 1 else 0 end),
                   coalesce(max(t.so_luong_kha_dung), 0)
            from bien_the_sp v
            join san_pham s on s.ma_sp = v.ma_sp
            left join danh_muc dm on dm.ma_danh_muc = s.ma_danh_muc
            left join ct_don_hang c on c.ma_sku = v.ma_sku
            left join don_hang d on d.ma_don_hang = c.ma_don_hang
            left join hoa_don i on i.ma_don_hang = d.ma_don_hang
            left join ton_kho t on t.ma_sku = v.ma_sku and t.da_xoa = false
            where v.da_xoa = false
            group by v.ma_sku, s.ma_sp, s.ten_sp, dm.ten_danh_muc, v.mau_sac, v.kich_co, v.ma_vach
            """, nativeQuery = true)
    List<Object[]> productSalesInRange(@Param("from") String from, @Param("to") String to);

    @Query(value = """
            select v.ma_sku, s.ten_sp, v.mau_sac, v.kich_co, v.ma_vach,
                   coalesce(sum(case when i.trang_thai = 'PAID' and i.da_xoa = false
                        and d.da_xoa = false
                        and d.trang_thai not in ('DRAFT', 'CANCELLED')
                        and date_trunc('month', i.ngay_lap) = date_trunc('month', cast(:month as timestamp))
                        then c.so_luong else 0 end), 0),
                   coalesce(max(t.so_luong_kha_dung), 0)
            from bien_the_sp v
            join san_pham s on s.ma_sp = v.ma_sp
            left join ct_don_hang c on c.ma_sku = v.ma_sku
            left join don_hang d on d.ma_don_hang = c.ma_don_hang
            left join hoa_don i on i.ma_don_hang = d.ma_don_hang
            left join ton_kho t on t.ma_sku = v.ma_sku and t.da_xoa = false
            where v.da_xoa = false and (:sku is null or v.ma_sku = cast(:sku as bigint))
            group by v.ma_sku, s.ten_sp, v.mau_sac, v.kich_co, v.ma_vach
            order by v.ma_sku
            """, nativeQuery = true)
    List<Object[]> skuMovementInMonth(@Param("month") String month, @Param("sku") Long sku);

    /** Units received on COMPLETED import receipts created in [from, to), per SKU of the given page. */
    @Query(value = """
            select d.ma_sku, coalesce(sum(d.so_luong), 0)
            from ct_phieu_nhap d
            join phieu_nhap_kho r on r.ma_phieu_nhap = d.ma_phieu_nhap
            where d.ma_sku in (:skus)
              and d.da_xoa = false and r.da_xoa = false and r.trang_thai = 'COMPLETED'
              and r.ngay_tao >= cast(:from as timestamp) and r.ngay_tao < cast(:to as timestamp)
            group by d.ma_sku
            """, nativeQuery = true)
    List<Object[]> importedUnitsInRange(@Param("skus") java.util.Collection<Long> skus,
            @Param("from") String from, @Param("to") String to);

    /** Units written off on COMPLETED export receipts of type DAMAGED created in [from, to), per SKU. */
    @Query(value = """
            select d.ma_sku, coalesce(sum(d.so_luong), 0)
            from ct_phieu_xuat d
            join phieu_xuat_kho r on r.ma_phieu_xuat = d.ma_phieu_xuat
            where d.ma_sku in (:skus)
              and d.da_xoa = false and r.da_xoa = false and r.trang_thai = 'COMPLETED'
              and r.loai_xuat = 'DAMAGED'
              and r.ngay_tao >= cast(:from as timestamp) and r.ngay_tao < cast(:to as timestamp)
            group by d.ma_sku
            """, nativeQuery = true)
    List<Object[]> damagedUnitsInRange(@Param("skus") java.util.Collection<Long> skus,
            @Param("from") String from, @Param("to") String to);

    @Query(value = "select count(*) from bien_the_sp where da_xoa = false", nativeQuery = true)
    long countActiveSkus();

    @Query(value = """
            select count(distinct s.ma_sp)
            from san_pham s
            join bien_the_sp v on v.ma_sp = s.ma_sp
            join ct_don_hang c on c.ma_sku = v.ma_sku
            join don_hang d on d.ma_don_hang = c.ma_don_hang
            join hoa_don i on i.ma_don_hang = d.ma_don_hang
            where s.da_xoa = true
              and i.trang_thai = 'PAID' and i.da_xoa = false
              and d.da_xoa = false
              and d.trang_thai not in ('DRAFT', 'CANCELLED')
              and i.ngay_lap >= cast(:from as timestamp) and i.ngay_lap < cast(:to as timestamp)
            """, nativeQuery = true)
    long countSoftDeletedProductsWithPaidSales(@Param("from") String from, @Param("to") String to);

    /** [revenue, paid invoice count] with the exact filter of the revenue report. */
    @Query(value = """
            select coalesce(sum(i.tong_tien_thuc_tra), 0), count(*)
            from hoa_don i join don_hang d on d.ma_don_hang = i.ma_don_hang
            where i.trang_thai = 'PAID' and i.da_xoa = false
              and d.da_xoa = false
              and d.trang_thai not in ('DRAFT', 'CANCELLED')
              and i.ngay_lap >= cast(:from as timestamp) and i.ngay_lap < cast(:to as timestamp)
            """, nativeQuery = true)
    List<Object[]> paidTotals(@Param("from") String from, @Param("to") String to);

    /** Customers (not deleted) whose first non-draft, non-cancelled order was placed in range. */
    @Query(value = """
            select count(*) from (
                select d.ma_kh, min(d.ngay_dat) as first_at
                from don_hang d join khach_hang k on k.ma_kh = d.ma_kh and k.da_xoa = false
                where d.da_xoa = false and d.trang_thai not in ('DRAFT', 'CANCELLED')
                group by d.ma_kh) f
            where f.first_at >= cast(:from as timestamp) and f.first_at < cast(:to as timestamp)
            """, nativeQuery = true)
    long countNewCustomers(@Param("from") String from, @Param("to") String to);

    @Query(value = """
            select dm.ma_danh_muc, coalesce(dm.ten_danh_muc, 'Chưa phân loại'),
                   coalesce(sum(c.so_luong * c.don_gia - coalesce(c.tien_giam, 0)
                                - coalesce(c.points_discount_amount, 0)), 0),
                   coalesce(sum(c.so_luong), 0)
            from hoa_don i
            join don_hang d on d.ma_don_hang = i.ma_don_hang
            join ct_don_hang c on c.ma_don_hang = d.ma_don_hang
            join bien_the_sp v on v.ma_sku = c.ma_sku
            join san_pham s on s.ma_sp = v.ma_sp
            left join danh_muc dm on dm.ma_danh_muc = s.ma_danh_muc
            where i.trang_thai = 'PAID' and i.da_xoa = false
              and d.da_xoa = false
              and d.trang_thai not in ('DRAFT', 'CANCELLED')
              and i.ngay_lap >= cast(:from as timestamp) and i.ngay_lap < cast(:to as timestamp)
            group by dm.ma_danh_muc, dm.ten_danh_muc
            order by 3 desc, 2
            """, nativeQuery = true)
    List<Object[]> revenueByCategory(@Param("from") String from, @Param("to") String to);

    @Query(value = """
            select d.trang_thai, count(*), coalesce(sum(d.tong_tien), 0)
            from don_hang d
            where d.da_xoa = false and d.trang_thai <> 'DRAFT'
              and d.ngay_dat >= cast(:from as timestamp) and d.ngay_dat < cast(:to as timestamp)
            group by d.trang_thai
            """, nativeQuery = true)
    List<Object[]> ordersByStatus(@Param("from") String from, @Param("to") String to);

    @Query(value = """
            select coalesce(nullif(i.payment_method_code, ''), 'OTHER'), count(*),
                   coalesce(sum(i.tong_tien_thuc_tra), 0)
            from hoa_don i join don_hang d on d.ma_don_hang = i.ma_don_hang
            where i.trang_thai = 'PAID' and i.da_xoa = false
              and d.da_xoa = false
              and d.trang_thai not in ('DRAFT', 'CANCELLED')
              and i.ngay_lap >= cast(:from as timestamp) and i.ngay_lap < cast(:to as timestamp)
            group by 1
            order by 3 desc, 1
            """, nativeQuery = true)
    List<Object[]> paidByMethod(@Param("from") String from, @Param("to") String to);

    @Query(value = """
            select k.ma_kh, btrim(coalesce(k.ho_kh, '') || ' ' || coalesce(k.ten_kh, '')), k.da_xoa,
                   count(*), coalesce(sum(i.tong_tien_thuc_tra), 0), max(i.ngay_lap)
            from hoa_don i
            join don_hang d on d.ma_don_hang = i.ma_don_hang
            join khach_hang k on k.ma_kh = d.ma_kh
            where i.trang_thai = 'PAID' and i.da_xoa = false
              and d.da_xoa = false
              and d.trang_thai not in ('DRAFT', 'CANCELLED')
              and i.ngay_lap >= cast(:from as timestamp) and i.ngay_lap < cast(:to as timestamp)
            group by k.ma_kh, k.ho_kh, k.ten_kh, k.da_xoa
            order by 5 desc, 1
            limit 10
            """, nativeQuery = true)
    List<Object[]> topCustomers(@Param("from") String from, @Param("to") String to);
}
