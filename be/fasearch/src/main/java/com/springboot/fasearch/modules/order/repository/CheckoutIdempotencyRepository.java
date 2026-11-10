package com.springboot.fasearch.modules.order.repository;

import org.springframework.data.jpa.repository.JpaRepository;

import com.springboot.fasearch.modules.order.entity.CheckoutIdempotency;
import com.springboot.fasearch.modules.order.entity.CheckoutIdempotencyId;

public interface CheckoutIdempotencyRepository extends JpaRepository<CheckoutIdempotency, CheckoutIdempotencyId> {
}
