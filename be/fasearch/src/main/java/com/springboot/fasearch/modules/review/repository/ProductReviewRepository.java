package com.springboot.fasearch.modules.review.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.springboot.fasearch.modules.review.entity.ProductReview;
import com.springboot.fasearch.modules.review.entity.ReviewSizeFit;

public interface ProductReviewRepository extends JpaRepository<ProductReview, Long> {

    Page<ProductReview> findByProduct_IdAndHiddenFalse(Long productId, Pageable pageable);

    Page<ProductReview> findByProduct_IdAndRatingAndHiddenFalse(Long productId, Integer rating, Pageable pageable);

    Optional<ProductReview> findByProduct_IdAndAccount_Id(Long productId, Long accountId);

    boolean existsByProduct_IdAndAccount_Id(Long productId, Long accountId);

    @Query("select r.rating, count(r) from ProductReview r "
            + "where r.product.id = :productId and r.hidden = false group by r.rating")
    List<Object[]> ratingDistribution(@Param("productId") Long productId);

    @Query("select r.sizeFit, count(r) from ProductReview r "
            + "where r.product.id = :productId and r.hidden = false and r.sizeFit is not null group by r.sizeFit")
    List<Object[]> fitDistribution(@Param("productId") Long productId);

    @Query("select r from ProductReview r where (:productId is null or r.product.id = :productId) "
            + "and (:hidden is null or r.hidden = :hidden)")
    Page<ProductReview> adminSearch(@Param("productId") Long productId, @Param("hidden") Boolean hidden,
            Pageable pageable);

    /** Có ít nhất một đơn COMPLETED của khách chứa sản phẩm này (mua thật). */
    @Query("select count(od) > 0 from OrderDetail od "
            + "where od.order.customer.account.id = :accountId "
            + "and od.order.status = com.springboot.fasearch.common.enums.OrderStatus.COMPLETED "
            + "and od.variant.product.id = :productId")
    boolean hasDeliveredOrder(@Param("accountId") Long accountId, @Param("productId") Long productId);
}
