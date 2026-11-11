package com.springboot.fasearch.modules.order.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.springboot.fasearch.modules.order.entity.CartItem;
import com.springboot.fasearch.modules.order.entity.CartItemId;

public interface CartItemRepository extends JpaRepository<CartItem, CartItemId> {

    List<CartItem> findById_CartId(Long cartId);

    Optional<CartItem> findById_CartIdAndId_SkuId(Long cartId, Long skuId);

    @Modifying
    @Query("DELETE FROM CartItem ci WHERE ci.id.cartId = :cartId")
    void deleteAllByCartId(@Param("cartId") Long cartId);

    @Modifying(flushAutomatically = true)
    @Query("DELETE FROM CartItem ci WHERE ci.id.cartId = :cartId AND ci.id.skuId = :skuId "
            + "AND ci.quantity = :quantity")
    int deleteSnapshotLine(@Param("cartId") Long cartId, @Param("skuId") Long skuId,
            @Param("quantity") Integer quantity);
}
