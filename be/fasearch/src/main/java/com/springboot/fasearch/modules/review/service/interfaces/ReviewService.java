package com.springboot.fasearch.modules.review.service.interfaces;

import com.springboot.fasearch.modules.review.dto.request.ReviewUpsertReq;
import com.springboot.fasearch.modules.review.dto.request.ReviewVisibilityReq;
import com.springboot.fasearch.modules.review.dto.response.ReviewEligibilityRes;
import com.springboot.fasearch.modules.review.dto.response.ReviewRes;
import com.springboot.fasearch.modules.review.dto.response.ReviewSummaryRes;
import com.springboot.fasearch.shared.PageResponse;

public interface ReviewService {
    PageResponse<ReviewRes> list(Long productId, Integer rating, String sort, int page, int size);

    ReviewSummaryRes summary(Long productId);

    ReviewEligibilityRes eligibility(Long productId);

    ReviewRes create(Long productId, ReviewUpsertReq request);

    ReviewRes update(Long productId, ReviewUpsertReq request);

    void delete(Long productId);

    PageResponse<ReviewRes> adminList(Long productId, Boolean hidden, int page, int size);

    ReviewRes setVisibility(Long reviewId, ReviewVisibilityReq request);
}
