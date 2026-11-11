package com.springboot.fasearch.modules.order.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.stereotype.Repository;

import com.springboot.fasearch.common.enums.OrderStatus;
import com.springboot.fasearch.modules.order.entity.Order;

@Repository
public interface OrderRepository extends JpaRepository<Order, Long>, JpaSpecificationExecutor<Order> {

    Optional<Order> findByOrderCode(String orderCode);

    boolean existsByOrderCode(String orderCode);

    long countByOrderCodeStartingWith(String prefix);

    Page<Order> findByCustomerId(Long customerId, Pageable pageable);

    /** One query for a CSV batch: the customer is fetched with the order. */
    @Query("select o from Order o left join fetch o.customer where o.id in :ids")
    List<Order> findExportRowsByIdIn(@Param("ids") java.util.Collection<Long> ids);

    List<Order> findByStatusOrderByOrderDateDesc(OrderStatus status);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select o from Order o where o.id = :id")
    Optional<Order> findByIdForUpdate(@Param("id") Long id);
}
