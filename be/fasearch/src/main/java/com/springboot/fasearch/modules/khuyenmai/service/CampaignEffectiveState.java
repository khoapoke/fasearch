package com.springboot.fasearch.modules.khuyenmai.service;

import java.time.LocalDateTime;
import java.util.Locale;

import jakarta.persistence.criteria.CriteriaBuilder;
import jakarta.persistence.criteria.Predicate;
import jakarta.persistence.criteria.Root;

import com.springboot.fasearch.modules.khuyenmai.entity.KhuyenMai;

/**
 * Trạng thái hiệu lực của chiến dịch tại một thời điểm, suy ra từ trạng thái lưu và khoảng ngày.
 * Thứ tự ưu tiên: đã kết thúc, chưa bắt đầu, tạm dừng, đang chạy (khớp nhãn hiển thị ở trang quản trị).
 */
public enum CampaignEffectiveState {
    DANG_CHAY, TAM_DUNG, DA_KET_THUC, CHUA_BAT_DAU;

    public static final String STORED_PAUSED = "TAM_DUNG";

    /** Null khi tham số rỗng; ném IllegalArgumentException khi không hỗ trợ. */
    public static CampaignEffectiveState parse(String raw) {
        if (raw == null || raw.isBlank()) return null;
        return valueOf(raw.strip().toUpperCase(Locale.ROOT));
    }

    public static CampaignEffectiveState of(String storedStatus, LocalDateTime startAt, LocalDateTime endAt, LocalDateTime now) {
        if (endAt != null && now.isAfter(endAt)) return DA_KET_THUC;
        if (startAt != null && now.isBefore(startAt)) return CHUA_BAT_DAU;
        return STORED_PAUSED.equals(storedStatus) ? TAM_DUNG : DANG_CHAY;
    }

    /** Điều kiện truy vấn tương đương {@link #of}, để lọc đúng trên mọi trang. */
    public Predicate toPredicate(Root<KhuyenMai> root, CriteriaBuilder cb, LocalDateTime now) {
        Predicate ended = cb.lessThan(root.<LocalDateTime>get("endAt"), now);
        Predicate notEnded = cb.not(ended);
        Predicate upcoming = cb.greaterThan(root.<LocalDateTime>get("startAt"), now);
        Predicate paused = cb.equal(root.get("status"), STORED_PAUSED);
        return switch (this) {
            case DA_KET_THUC -> ended;
            case CHUA_BAT_DAU -> cb.and(notEnded, upcoming);
            case TAM_DUNG -> cb.and(notEnded, cb.not(upcoming), paused);
            case DANG_CHAY -> cb.and(notEnded, cb.not(upcoming), cb.not(paused));
        };
    }
}
