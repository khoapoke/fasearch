package com.springboot.fasearch.modules.auth.service.impl;

import java.time.Duration;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.concurrent.ConcurrentHashMap;

import org.springframework.stereotype.Component;

import com.springboot.fasearch.exception.AppException;
import com.springboot.fasearch.exception.ErrorCode;

/**
 * Gioi han tan suat trong bo nho (single-instance).
 *
 * <p>Du cho cac endpoint email cong khai (forgot/reset/verify): chan spam ma
 * khong can ha tang ngoai. GHI CHU: state nam trong heap cua instance nay,
 * khi chay nhieu replica can thay bang Redis/DB.
 */
@Component
public class InMemoryRateLimiter {

    private final ConcurrentHashMap<String, Deque<Long>> buckets = new ConcurrentHashMap<>();

    /** Gioi han mac dinh: so luot toi da moi gio. Vuot qua -> 429. */
    public void check(String key, int maxPerHour) {
        check(key, maxPerHour, Duration.ofHours(1));
    }

    void check(String key, int maxPerHour, Duration window) {
        long now = System.currentTimeMillis();
        long cutoff = now - window.toMillis();
        Deque<Long> deque = buckets.computeIfAbsent(key, k -> new ArrayDeque<>());
        synchronized (deque) {
            while (!deque.isEmpty() && deque.peekFirst() <= cutoff) {
                deque.pollFirst();
            }
            if (deque.size() >= maxPerHour) {
                throw new AppException(ErrorCode.TOO_MANY_REQUESTS);
            }
            deque.addLast(now);
        }
    }

    /** Xoa het state (phuc vu test). */
    void reset() {
        buckets.clear();
    }
}
