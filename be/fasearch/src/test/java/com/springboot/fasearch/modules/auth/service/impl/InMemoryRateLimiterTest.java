package com.springboot.fasearch.modules.auth.service.impl;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Duration;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import com.springboot.fasearch.exception.AppException;
import com.springboot.fasearch.exception.ErrorCode;

class InMemoryRateLimiterTest {

    private InMemoryRateLimiter limiter;

    @BeforeEach
    void setUp() {
        limiter = new InMemoryRateLimiter();
    }

    @Test
    void allowsUpToLimitThenRejectsWith429() {
        for (int i = 0; i < 5; i++) {
            limiter.check("key-1", 5, Duration.ofMinutes(1));
        }
        assertThatThrownBy(() -> limiter.check("key-1", 5, Duration.ofMinutes(1)))
                .isInstanceOf(AppException.class)
                .satisfies(e -> assertThat(((AppException) e).getErrorCode()).isEqualTo(ErrorCode.TOO_MANY_REQUESTS));
    }

    @Test
    void bucketsAreIndependentPerKey() {
        for (int i = 0; i < 5; i++) {
            limiter.check("key-a", 5, Duration.ofMinutes(1));
        }
        limiter.check("key-b", 5, Duration.ofMinutes(1));
    }

    @Test
    void windowExpiryRefillsBudget() throws InterruptedException {
        limiter.check("key-c", 1, Duration.ofMillis(50));
        assertThatThrownBy(() -> limiter.check("key-c", 1, Duration.ofMillis(50)))
                .isInstanceOf(AppException.class);
        Thread.sleep(120);
        limiter.check("key-c", 1, Duration.ofMillis(50));
    }
}
