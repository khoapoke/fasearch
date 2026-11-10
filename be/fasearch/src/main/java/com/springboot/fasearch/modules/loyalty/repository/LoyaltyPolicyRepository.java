package com.springboot.fasearch.modules.loyalty.repository;

import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.springboot.fasearch.modules.loyalty.entity.LoyaltyPolicy;
import com.springboot.fasearch.modules.loyalty.entity.LoyaltyPolicyStatus;

import jakarta.persistence.LockModeType;

public interface LoyaltyPolicyRepository extends JpaRepository<LoyaltyPolicy, Long> {
    Optional<LoyaltyPolicy> findFirstByStatusOrderByIdDesc(LoyaltyPolicyStatus status);
    Optional<LoyaltyPolicy> findFirstByOrderByIdDesc();

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select p from LoyaltyPolicy p where p.id = :id")
    Optional<LoyaltyPolicy> findByIdForUpdate(@Param("id") Long id);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select p from LoyaltyPolicy p where p.status = :status")
    Optional<LoyaltyPolicy> findByStatusForUpdate(@Param("status") LoyaltyPolicyStatus status);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select p from LoyaltyPolicy p order by p.id desc")
    java.util.List<LoyaltyPolicy> findAllForUpdate();
}
