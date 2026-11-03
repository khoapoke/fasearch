package com.springboot.fasearch.modules.payment.attempt.entity;

public enum PaymentAttemptStatus {
    CREATED,
    PENDING,
    SETTLEMENT_PENDING,
    SETTLED,
    FAILED,
    CANCELLED,
    EXPIRED,
    REVIEW_REQUIRED
}
