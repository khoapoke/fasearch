package com.springboot.fasearch.modules.product.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import jakarta.persistence.LockModeType;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

import com.springboot.fasearch.modules.product.entity.Product;

public interface ProductRepository extends JpaRepository<Product, Long>, JpaSpecificationExecutor<Product> {

    long countByCategory_IdAndIsDeletedFalse(Long categoryId);

    /**
     * Sản phẩm liên quan trong MỘT truy vấn: cùng danh mục trước, rồi cùng thương hiệu; chỉ hàng đang bán
     * (PUBLISHED + ACTIVE, có ít nhất một SKU còn tồn khả dụng). Category/brand được fetch cùng để mapper không N+1.
     */
    @Query("select p from Product p left join fetch p.category c left join fetch p.brand b "
            + "where p.id <> :id and p.status = com.springboot.fasearch.common.enums.ProductStatus.ACTIVE "
            + "and p.publicationStatus = com.springboot.fasearch.modules.publish.entity.PublicationStatus.PUBLISHED "
            + "and (c.id = :categoryId or b.id = :brandId) "
            + "and exists (select 1 from Inventory i where i.variant.product = p and i.variant.isDeleted = false "
            + "and i.isDeleted = false and i.availableStock > 0) "
            + "order by case when c.id = :categoryId then 0 else 1 end, case when b.id = :brandId then 0 else 1 end, p.id desc")
    java.util.List<Product> findRelated(@Param("id") Long id, @Param("categoryId") Long categoryId,
            @Param("brandId") Long brandId, org.springframework.data.domain.Pageable pageable);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select p from Product p where p.id = :id")
    Optional<Product> findByIdForUpdate(@Param("id") Long id);

    /**
     * Một truy vấn gộp cho tìm kiếm AI: chỉ trả sản phẩm đang bán thật
     * (chưa xóa mềm, PUBLISHED, ACTIVE, có ít nhất một biến thể còn tồn kho khả dụng).
     */
    @Query("""
            select p from Product p left join fetch p.brand
            where p.id in :ids
              and p.isDeleted = false
              and p.publicationStatus = com.springboot.fasearch.modules.publish.entity.PublicationStatus.PUBLISHED
              and p.status = com.springboot.fasearch.common.enums.ProductStatus.ACTIVE
              and exists (select 1 from Inventory i join i.variant v
                          where v.product = p and v.isDeleted = false
                            and i.isDeleted = false and i.availableStock > 0)
            """)
    List<Product> findLiveInStockByIdIn(@Param("ids") Collection<Long> ids);

    /**
     * Toàn bộ khóa nhận diện sản phẩm cho lần nhập CSV, kể cả hàng đã xóa mềm.
     * Cột: ma_sp, ten_sp, ma_danh_muc, ma_thuong_hieu, model_code, da_xoa.
     */
    @Query(value = "select ma_sp, ten_sp, ma_danh_muc, ma_thuong_hieu, model_code, da_xoa from san_pham",
            nativeQuery = true)
    List<Object[]> findImportIdentityRows();

    /** Màu của các biến thể còn hàng, theo thứ tự biến thể: [productId, color]. */
    @Query("""
            select v.product.id, v.color from Inventory i join i.variant v
            where v.product.id in :ids and v.isDeleted = false
              and i.isDeleted = false and i.availableStock > 0
            order by v.id
            """)
    List<Object[]> findInStockColorsByProductIdIn(@Param("ids") Collection<Long> ids);
}
