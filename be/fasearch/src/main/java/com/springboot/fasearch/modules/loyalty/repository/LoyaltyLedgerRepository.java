package com.springboot.fasearch.modules.loyalty.repository;

import java.util.Optional;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import com.springboot.fasearch.modules.loyalty.entity.LoyaltyEntryType;
import com.springboot.fasearch.modules.loyalty.entity.LoyaltyLedgerEntry;

public interface LoyaltyLedgerRepository extends JpaRepository<LoyaltyLedgerEntry, Long> {
    boolean existsByCustomer_IdAndType(Long customerId, LoyaltyEntryType type);
    Optional<LoyaltyLedgerEntry> findByCustomer_IdAndSourceKey(Long customerId, String sourceKey);
    Page<LoyaltyLedgerEntry> findByCustomer_IdOrderByOccurredAtDescIdDesc(Long customerId, Pageable pageable);
}
