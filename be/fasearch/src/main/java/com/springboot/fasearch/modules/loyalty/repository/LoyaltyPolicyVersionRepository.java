package com.springboot.fasearch.modules.loyalty.repository;

import java.util.Optional;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.springboot.fasearch.modules.loyalty.entity.LoyaltyPolicyVersion;

import jakarta.persistence.LockModeType;

public interface LoyaltyPolicyVersionRepository extends JpaRepository<LoyaltyPolicyVersion, Long> {
    Optional<LoyaltyPolicyVersion> findFirstByPolicyIdOrderByVersionDesc(Long policyId);
    Page<LoyaltyPolicyVersion> findAllByOrderByPolicyIdDescVersionDesc(Pageable pageable);
    Optional<LoyaltyPolicyVersion> findByPolicyIdAndVersion(Long policyId, Long version);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select p from LoyaltyPolicyVersion p where p.id = :id")
    Optional<LoyaltyPolicyVersion> findByIdForUpdate(@Param("id") Long id);

}
