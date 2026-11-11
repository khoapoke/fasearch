package com.springboot.fasearch.modules.review.dto.response;

import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class ReviewEligibilityRes {
    /** Có thể viết đánh giá mới (đã nhận hàng và chưa đánh giá). */
    private boolean canReview;
    private boolean purchased;
    private boolean alreadyReviewed;
    /** NOT_PURCHASED | ALREADY_REVIEWED | null. */
    private String reason;
    private ReviewRes myReview;
}
