package com.springboot.fasearch.modules.loyalty.repository;

import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.springboot.fasearch.modules.loyalty.entity.LoyaltyHoldStatus;
import com.springboot.fasearch.modules.loyalty.entity.LoyaltyOrderHold;

import jakarta.persistence.LockModeType;

public interface LoyaltyOrderHoldRepository extends JpaRepository<LoyaltyOrderHold, Long> {
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select h from LoyaltyOrderHold h where h.orderId = :orderId")
    Optional<LoyaltyOrderHold> findByOrderIdForUpdate(@Param("orderId") Long orderId);

    @Query("select coalesce(sum(h.points), 0) from LoyaltyOrderHold h where h.customer.id = :customerId and h.status = :status")
    Long sumPointsByCustomerAndStatus(@Param("customerId") Long customerId, @Param("status") LoyaltyHoldStatus status);
}
