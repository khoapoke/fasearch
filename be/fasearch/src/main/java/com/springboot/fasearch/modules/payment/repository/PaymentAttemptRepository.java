package com.springboot.fasearch.modules.payment.repository;

import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import jakarta.persistence.LockModeType;

import com.springboot.fasearch.modules.payment.entity.PaymentAttempt;
import com.springboot.fasearch.modules.payment.entity.PaymentProvider;

public interface PaymentAttemptRepository extends JpaRepository<PaymentAttempt, Long> {
    Optional<PaymentAttempt> findByProviderAndIdempotencyKey(PaymentProvider provider, String idempotencyKey);
    Optional<PaymentAttempt> findFirstByProviderAndOrder_IdAndIdempotencyKeyStartingWithOrderByIdDesc(
            PaymentProvider provider, Long orderId, String keyPrefix);
    long countByProviderAndOrder_IdAndIdempotencyKeyStartingWith(PaymentProvider provider, Long orderId, String keyPrefix);
    Optional<PaymentAttempt> findByProviderAndProviderReference(PaymentProvider provider, String providerReference);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select a from PaymentAttempt a where a.provider = :provider and a.providerReference = :reference")
    Optional<PaymentAttempt> findByProviderAndProviderReferenceForUpdate(@Param("provider") PaymentProvider provider, @Param("reference") String providerReference);
}
