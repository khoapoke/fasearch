package com.springboot.fasearch.modules.loyalty.repository;

import java.util.Optional;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.springboot.fasearch.modules.loyalty.entity.LoyaltyEntryType;
import com.springboot.fasearch.modules.loyalty.entity.LoyaltyLedgerEntry;

public interface LoyaltyLedgerRepository extends JpaRepository<LoyaltyLedgerEntry, Long> {
    boolean existsByCustomer_IdAndType(Long customerId, LoyaltyEntryType type);
    Optional<LoyaltyLedgerEntry> findByCustomer_IdAndSourceKey(Long customerId, String sourceKey);
    Page<LoyaltyLedgerEntry> findByCustomer_IdOrderByOccurredAtDescIdDesc(Long customerId, Pageable pageable);

    /** Net balance effect of the ledger: EARN and signed ADJUST add, REDEEM subtracts; OPENING, HOLD and RELEASE are neutral here. */
    @Query("select coalesce(sum(case when e.type in (com.springboot.fasearch.modules.loyalty.entity.LoyaltyEntryType.EARN, "
            + "com.springboot.fasearch.modules.loyalty.entity.LoyaltyEntryType.ADJUST) then e.points "
            + "when e.type = com.springboot.fasearch.modules.loyalty.entity.LoyaltyEntryType.REDEEM then -e.points else 0 end), 0) "
            + "from LoyaltyLedgerEntry e where e.customer.id = :customerId")
    long sumBalanceEffect(@Param("customerId") Long customerId);

    /**
     * Balance effect (EARN and ADJUST add, REDEEM subtracts; OPENING, HOLD and RELEASE are neutral) of the newest {@code n} rows in
     * history order. Used to derive "balance after" for a history page: current balance minus this sum.
     */
    @Query(value = "select coalesce(sum(case when t.entry_type in ('EARN', 'ADJUST') then t.points "
            + "when t.entry_type = 'REDEEM' then -t.points else 0 end), 0) from ("
            + "select entry_type, points from loyalty_ledger_entry where customer_id = :customerId "
            + "order by occurred_at desc, entry_id desc limit :n) t", nativeQuery = true)
    long sumNewestEffect(@Param("customerId") Long customerId, @Param("n") int n);
}
