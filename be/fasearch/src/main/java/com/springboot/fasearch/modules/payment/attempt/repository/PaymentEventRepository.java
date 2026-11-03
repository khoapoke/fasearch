package com.springboot.fasearch.modules.payment.attempt.repository;

import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

import com.springboot.fasearch.modules.payment.attempt.entity.PaymentEvent;
import com.springboot.fasearch.modules.payment.attempt.entity.PaymentProvider;

public interface PaymentEventRepository extends JpaRepository<PaymentEvent, Long> {
    Optional<PaymentEvent> findByProviderAndProviderEventId(PaymentProvider provider, String providerEventId);
}
