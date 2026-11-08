package com.springboot.fasearch.modules.product.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.springboot.fasearch.modules.product.entity.ProductVariant;

public interface ProductVariantRepository extends JpaRepository<ProductVariant, Long>, JpaSpecificationExecutor<ProductVariant> {

    boolean existsByBarcode(String barcode);

    boolean existsByBarcodeAndIdNot(String barcode, Long id);

    Optional<ProductVariant> findByBarcode(String barcode);

    Optional<ProductVariant> findByBarcodeIgnoreCase(String barcode);

    List<ProductVariant> findByProductId(Long productId);

    /** One query for a CSV batch: product, category and brand are fetched with the SKU. */
    @Query("select v from ProductVariant v join fetch v.product p left join fetch p.category left join fetch p.brand "
            + "where v.id in :ids")
    List<ProductVariant> findExportRowsByIdIn(@Param("ids") java.util.Collection<Long> ids);

    boolean existsByProductIdAndColorIgnoreCaseAndSizeIgnoreCase(Long productId, String color, String size);

    boolean existsByProductIdAndColorIgnoreCaseAndSizeIgnoreCaseAndIdNot(Long productId, String color, String size, Long id);

    /**
     * Mọi mã vạch hiện có cho lần nhập CSV, kể cả SKU đã xóa mềm: unique index vẫn giữ chỗ nên
     * không thể tạo SKU mới trùng mã. Cột: ma_sku, ma_vach, da_xoa.
     */
    @Query(value = "select ma_sku, ma_vach, da_xoa from bien_the_sp where ma_vach is not null",
            nativeQuery = true)
    List<Object[]> findImportBarcodeRows();

    /**
     * Ảnh chụp tên/màu/cỡ/mã vạch cho chứng từ cũ. SQL gốc nên KHÔNG bị
     * {@code @SQLRestriction} lọc: đơn, phiếu nhập/xuất và phiếu kiểm kê đã lập vẫn hiển thị
     * được tên SKU/sản phẩm kể cả khi SKU hoặc sản phẩm sau đó đã xóa mềm.
     * Cột: ma_sku, ten_sp, mau_sac, kich_co, ma_vach, hinh_anh_sp.
     */
    @Query(value = """
            select v.ma_sku, s.ten_sp, v.mau_sac, v.kich_co, v.ma_vach, s.hinh_anh_sp
            from bien_the_sp v
            left join san_pham s on s.ma_sp = v.ma_sp
            where v.ma_sku in (:skuIds)
            """, nativeQuery = true)
    java.util.List<Object[]> findHistorySnapshots(@Param("skuIds") java.util.Collection<Long> skuIds);
}
