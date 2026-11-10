package com.springboot.fasearch.modules.review.service.impl;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.Collection;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.springboot.fasearch.exception.AppException;
import com.springboot.fasearch.exception.ErrorCode;
import com.springboot.fasearch.modules.auth.entity.Account;
import com.springboot.fasearch.modules.auth.repository.AccountRepository;
import com.springboot.fasearch.modules.product.entity.Product;
import com.springboot.fasearch.modules.product.repository.ProductRepository;
import com.springboot.fasearch.modules.review.dto.request.ReviewUpsertReq;
import com.springboot.fasearch.modules.review.dto.request.ReviewVisibilityReq;
import com.springboot.fasearch.modules.review.dto.response.ReviewEligibilityRes;
import com.springboot.fasearch.modules.review.dto.response.ReviewRes;
import com.springboot.fasearch.modules.review.dto.response.ReviewSummaryRes;
import com.springboot.fasearch.modules.review.entity.ProductReview;
import com.springboot.fasearch.modules.review.entity.ReviewSizeFit;
import com.springboot.fasearch.modules.review.repository.ProductReviewRepository;
import com.springboot.fasearch.modules.review.service.interfaces.ReviewService;
import com.springboot.fasearch.modules.user.entity.Customer;
import com.springboot.fasearch.modules.user.repository.UserRepository;
import com.springboot.fasearch.security.SecurityUtils;
import com.springboot.fasearch.shared.PageResponse;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class ReviewServiceImpl implements ReviewService {
    private static final int MIN_FIT_SAMPLES = 5;

    private final ProductReviewRepository reviewRepository;
    private final ProductRepository productRepository;
    private final AccountRepository accountRepository;
    private final UserRepository userRepository;

    @Override
    @Transactional(readOnly = true)
    public PageResponse<ReviewRes> list(Long productId, Integer rating, String sort, int page, int size) {
        requireProduct(productId);
        if (rating != null && (rating < 1 || rating > 5)) {
            throw new AppException(ErrorCode.INVALID_REQUEST, "Số sao lọc phải từ 1 đến 5");
        }
        Pageable pageable = PageRequest.of(page, size, sortFor(sort));
        Page<ProductReview> result = rating == null
                ? reviewRepository.findByProduct_IdAndHiddenFalse(productId, pageable)
                : reviewRepository.findByProduct_IdAndRatingAndHiddenFalse(productId, rating, pageable);
        return toPage(result, false, false);
    }

    @Override
    @Transactional(readOnly = true)
    public ReviewSummaryRes summary(Long productId) {
        requireProduct(productId);
        Map<String, Long> distribution = new LinkedHashMap<>();
        for (int star = 5; star >= 1; star--) {
            distribution.put(String.valueOf(star), 0L);
        }
        long count = 0;
        long total = 0;
        for (Object[] row : reviewRepository.ratingDistribution(productId)) {
            int star = ((Number) row[0]).intValue();
            long n = ((Number) row[1]).longValue();
            distribution.put(String.valueOf(star), n);
            count += n;
            total += (long) star * n;
        }
        Map<String, Long> fit = new LinkedHashMap<>();
        for (ReviewSizeFit f : ReviewSizeFit.values()) {
            fit.put(f.name(), 0L);
        }
        long fitCount = 0;
        for (Object[] row : reviewRepository.fitDistribution(productId)) {
            long n = ((Number) row[1]).longValue();
            fit.put(((ReviewSizeFit) row[0]).name(), n);
            fitCount += n;
        }
        String verdict = null;
        if (fitCount >= MIN_FIT_SAMPLES) {
            verdict = fit.entrySet().stream().max(Map.Entry.comparingByValue()).map(Map.Entry::getKey).orElse(null);
        }
        double average = count == 0 ? 0
                : BigDecimal.valueOf(total).divide(BigDecimal.valueOf(count), 1, RoundingMode.HALF_UP).doubleValue();
        return ReviewSummaryRes.builder().productId(productId).average(average).count(count)
                .distribution(distribution).fit(fit).fitCount(fitCount).fitVerdict(verdict).build();
    }

    @Override
    @Transactional(readOnly = true)
    public ReviewEligibilityRes eligibility(Long productId) {
        requireProduct(productId);
        Account account = currentAccount();
        boolean purchased = reviewRepository.hasDeliveredOrder(account.getId(), productId);
        ProductReview mine = reviewRepository.findByProduct_IdAndAccount_Id(productId, account.getId()).orElse(null);
        String reason = mine != null ? "ALREADY_REVIEWED" : (purchased ? null : "NOT_PURCHASED");
        return ReviewEligibilityRes.builder()
                .canReview(purchased && mine == null)
                .purchased(purchased)
                .alreadyReviewed(mine != null)
                .reason(reason)
                .myReview(mine == null ? null : toRes(mine, nameFor(account.getId()), true, false))
                .build();
    }

    @Override
    @Transactional
    public ReviewRes create(Long productId, ReviewUpsertReq request) {
        Product product = requireProduct(productId);
        Account account = currentAccount();
        if (!reviewRepository.hasDeliveredOrder(account.getId(), productId)) {
            throw new AppException(ErrorCode.REVIEW_NOT_ELIGIBLE);
        }
        if (reviewRepository.existsByProduct_IdAndAccount_Id(productId, account.getId())) {
            throw new AppException(ErrorCode.REVIEW_ALREADY_EXISTS);
        }
        ProductReview saved;
        try {
            saved = reviewRepository.saveAndFlush(ProductReview.builder()
                    .product(product)
                    .account(account)
                    .rating(request.getRating())
                    .title(clean(request.getTitle()))
                    .body(clean(request.getBody()))
                    .sizeFit(request.getSizeFit())
                    .verifiedPurchase(true)
                    .build());
        } catch (DataIntegrityViolationException duplicate) {
            // Hai lần gửi đồng thời cùng vượt qua existsBy…: chỉ mục unique từng phần là chốt chặn cuối.
            throw new AppException(ErrorCode.REVIEW_ALREADY_EXISTS);
        }
        return toRes(saved, nameFor(account.getId()), true, false);
    }

    @Override
    @Transactional
    public ReviewRes update(Long productId, ReviewUpsertReq request) {
        requireProduct(productId);
        Account account = currentAccount();
        ProductReview review = reviewRepository.findByProduct_IdAndAccount_Id(productId, account.getId())
                .orElseThrow(() -> new AppException(ErrorCode.REVIEW_NOT_FOUND));
        review.setRating(request.getRating());
        review.setTitle(clean(request.getTitle()));
        review.setBody(clean(request.getBody()));
        review.setSizeFit(request.getSizeFit());
        return toRes(reviewRepository.saveAndFlush(review), nameFor(account.getId()), true, false);
    }

    @Override
    @Transactional
    public void delete(Long productId) {
        Account account = currentAccount();
        ProductReview review = reviewRepository.findByProduct_IdAndAccount_Id(productId, account.getId())
                .orElseThrow(() -> new AppException(ErrorCode.REVIEW_NOT_FOUND));
        review.setIsDeleted(true);
        reviewRepository.saveAndFlush(review);
    }

    @Override
    @Transactional(readOnly = true)
    public PageResponse<ReviewRes> adminList(Long productId, Boolean hidden, int page, int size) {
        Pageable pageable = PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "createdAt"));
        return toPage(reviewRepository.adminSearch(productId, hidden, pageable), true, true);
    }

    @Override
    @Transactional
    public ReviewRes setVisibility(Long reviewId, ReviewVisibilityReq request) {
        ProductReview review = reviewRepository.findById(reviewId)
                .orElseThrow(() -> new AppException(ErrorCode.REVIEW_NOT_FOUND));
        Account actor = currentAccount();
        boolean hide = Boolean.TRUE.equals(request.getHidden());
        review.setHidden(hide);
        review.setHiddenReason(hide ? clean(request.getReason()) : null);
        review.setHiddenBy(hide ? actor : null);
        ProductReview saved = reviewRepository.saveAndFlush(review);
        return toRes(saved, nameFor(saved.getAccount().getId()), true, true);
    }

    // ---- helpers -------------------------------------------------------------------------

    private Product requireProduct(Long productId) {
        return productRepository.findById(productId)
                .orElseThrow(() -> new AppException(ErrorCode.PRODUCT_NOT_FOUND));
    }

    private Account currentAccount() {
        String username = SecurityUtils.getCurrentUsername()
                .orElseThrow(() -> new AppException(ErrorCode.UNAUTHENTICATED));
        return accountRepository.findByUsername(username)
                .orElseThrow(() -> new AppException(ErrorCode.UNAUTHENTICATED));
    }

    private static Sort sortFor(String sort) {
        Sort byNewest = Sort.by(Sort.Direction.DESC, "createdAt");
        if (sort == null || sort.isBlank() || "newest".equalsIgnoreCase(sort)) {
            return byNewest;
        }
        if ("rating_desc".equalsIgnoreCase(sort) || "highest".equalsIgnoreCase(sort)) {
            return Sort.by(Sort.Direction.DESC, "rating").and(byNewest);
        }
        if ("rating_asc".equalsIgnoreCase(sort) || "lowest".equalsIgnoreCase(sort)) {
            return Sort.by(Sort.Direction.ASC, "rating").and(byNewest);
        }
        throw new AppException(ErrorCode.INVALID_REQUEST, "sort phải là newest, rating_desc hoặc rating_asc");
    }

    private PageResponse<ReviewRes> toPage(Page<ProductReview> page, boolean withModeration, boolean withProduct) {
        Map<Long, String> names = namesFor(page.getContent().stream()
                .map(r -> r.getAccount().getId()).collect(Collectors.toSet()));
        return PageResponse.from(page.map(r -> {
            ReviewRes res = toRes(r, names.getOrDefault(r.getAccount().getId(), "Khách hàng"), withModeration,
                    withProduct);
            return res;
        }));
    }

    private ReviewRes toRes(ProductReview r, String author, boolean withModeration, boolean withProduct) {
        return ReviewRes.builder()
                .id(r.getId())
                .productId(r.getProduct().getId())
                .rating(r.getRating())
                .title(r.getTitle())
                .body(r.getBody())
                .sizeFit(r.getSizeFit())
                .verifiedPurchase(Boolean.TRUE.equals(r.getVerifiedPurchase()))
                .authorName(author)
                .createdAt(r.getCreatedAt())
                .updatedAt(r.getUpdatedAt())
                .hidden(withModeration ? r.getHidden() : null)
                .hiddenReason(withModeration ? r.getHiddenReason() : null)
                .productName(withProduct ? r.getProduct().getProductName() : null)
                .build();
    }

    private String nameFor(Long accountId) {
        return namesFor(List.of(accountId)).getOrDefault(accountId, "Khách hàng");
    }

    private Map<Long, String> namesFor(Collection<Long> accountIds) {
        if (accountIds.isEmpty()) {
            return Map.of();
        }
        Map<Long, String> names = new HashMap<>();
        for (Customer c : userRepository.findByAccount_IdIn(accountIds)) {
            names.put(c.getAccount().getId(), shortName(c));
        }
        return names;
    }

    /** "Nguyễn Văn A" (ho_kh=Nguyễn, ten_kh=Văn A) → "Nguyễn A." – không lộ tên đầy đủ. */
    static String shortName(Customer c) {
        String ho = c.getFirstName() == null ? "" : c.getFirstName().trim();
        String ten = c.getLastName() == null ? "" : c.getLastName().trim();
        String lastWord = ten.isEmpty() ? "" : ten.substring(ten.lastIndexOf(' ') + 1);
        String initial = lastWord.isEmpty() ? "" : lastWord.substring(0, 1).toUpperCase() + ".";
        String joined = (ho.isEmpty() ? "" : ho.split("\\s+")[0] + " ") + initial;
        return joined.isBlank() ? "Khách hàng" : joined.trim();
    }

    private static String clean(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }
}
