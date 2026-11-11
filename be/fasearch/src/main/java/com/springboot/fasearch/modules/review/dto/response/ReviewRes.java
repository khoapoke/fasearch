package com.springboot.fasearch.modules.review.dto.response;

import java.time.LocalDateTime;

import com.springboot.fasearch.modules.review.entity.ReviewSizeFit;

import com.fasterxml.jackson.annotation.JsonInclude;

import lombok.Builder;
import lombok.Getter;

@JsonInclude(JsonInclude.Include.NON_NULL)
@Getter
@Builder
public class ReviewRes {
    private Long id;
    private Long productId;
    private Integer rating;
    private String title;
    private String body;
    private ReviewSizeFit sizeFit;
    private boolean verifiedPurchase;
    /** Tên rút gọn, ví dụ "Nguyễn A."; không lộ tên đầy đủ hay tài khoản. */
    private String authorName;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    /** Chỉ trả cho tác giả / quản trị. */
    private Boolean hidden;
    private String hiddenReason;
    private String productName;
}
