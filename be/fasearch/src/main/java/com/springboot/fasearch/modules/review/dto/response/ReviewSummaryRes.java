package com.springboot.fasearch.modules.review.dto.response;

import java.util.Map;

import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class ReviewSummaryRes {
    private Long productId;
    /** Trung bình sao làm tròn 1 chữ số; 0 khi chưa có đánh giá. */
    private double average;
    private long count;
    /** Khóa "1".."5" → số đánh giá. */
    private Map<String, Long> distribution;
    /** Khóa NHO/VUA/RONG → số đánh giá có chọn cảm nhận kích cỡ. */
    private Map<String, Long> fit;
    private long fitCount;
    /** Nhãn gợi ý hiển thị: NHO, VUA, RONG hoặc null khi chưa đủ dữ liệu. */
    private String fitVerdict;
}
