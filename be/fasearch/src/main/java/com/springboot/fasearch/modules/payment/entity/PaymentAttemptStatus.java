package com.springboot.fasearch.modules.payment.entity;

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
