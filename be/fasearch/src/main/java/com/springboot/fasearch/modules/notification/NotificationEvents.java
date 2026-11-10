package com.springboot.fasearch.modules.notification;

public final class NotificationEvents {
    private NotificationEvents() {}
    /** Published inside the order mutation; delivery happens only after commit. */
    public record OrderChanged(Long orderId, String status) {}
}
