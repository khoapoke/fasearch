package com.springboot.fasearch.modules.loyalty.service.interfaces;

import com.springboot.fasearch.modules.loyalty.service.LoyaltyMath;
import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

import com.springboot.fasearch.exception.AppException;
import com.springboot.fasearch.exception.ErrorCode;
import com.springboot.fasearch.exception.FieldErrorDetail;
import com.springboot.fasearch.modules.loyalty.dto.response.LedgerItemResponse;
import com.springboot.fasearch.modules.loyalty.dto.request.PointsAdjustmentRequest;
import com.springboot.fasearch.modules.loyalty.dto.response.AdminLedgerItemResponse;
import com.springboot.fasearch.modules.loyalty.dto.response.EarnRecalcResponse;
import com.springboot.fasearch.modules.loyalty.dto.response.PointsAdjustmentResponse;
import com.springboot.fasearch.modules.loyalty.dto.request.LegacyOpeningRequest;
import com.springboot.fasearch.modules.loyalty.dto.response.LegacyOpeningResponse;
import com.springboot.fasearch.modules.loyalty.dto.response.CustomerLoyaltyPolicyRes;
import com.springboot.fasearch.modules.loyalty.dto.response.LoyaltyBalanceResponse;
import com.springboot.fasearch.modules.loyalty.dto.request.LoyaltyPolicyCreateRequest;
import com.springboot.fasearch.modules.loyalty.dto.response.LoyaltyPolicyResponse;
import com.springboot.fasearch.modules.loyalty.dto.request.LoyaltyPolicyUpdateRequest;
import com.springboot.fasearch.modules.loyalty.dto.response.SalesTierResponse;
import com.springboot.fasearch.modules.loyalty.dto.request.SalesTierUpdateRequest;
import com.springboot.fasearch.modules.order.entity.Order;
import com.springboot.fasearch.modules.user.dto.response.CustomerRes;
import com.springboot.fasearch.modules.user.entity.Customer;
import com.springboot.fasearch.shared.PageResponse;

public interface LoyaltyService {
    LoyaltyBalanceResponse myBalance();
    CustomerLoyaltyPolicyRes myPolicy();
    LoyaltyBalanceResponse customerBalance(Long customerId);
    PageResponse<LedgerItemResponse> myHistory(int page, int size);
    /** Staff view of a customer's ledger with reason, note, actor and balance after each row. */
    PageResponse<AdminLedgerItemResponse> customerHistory(Long customerId, int page, int size);
    /** Manual +/- adjustment. Single permission check point: ADMIN only (O1 will map it to LOYALTY_ADJUST). */
    PointsAdjustmentResponse adjustPoints(Long customerId, PointsAdjustmentRequest request);
    /** Read-only preview of the EARN entry that {@link #recalculateEarn} would write. */
    EarnRecalcResponse previewEarnRecalc(Long orderId);
    /** Writes the missing EARN entry (key earn:{orderId}) through the normal earn code path. */
    EarnRecalcResponse recalculateEarn(Long orderId);
    PageResponse<LoyaltyPolicyResponse> policies(int page, int size);
    LoyaltyPolicyResponse createPolicy(LoyaltyPolicyCreateRequest request);
    LoyaltyPolicyResponse updatePolicy(Long policyId, LoyaltyPolicyUpdateRequest request);
    LegacyOpeningResponse openLegacyBalance(LegacyOpeningRequest request);
    List<SalesTierResponse> salesTiers();
    SalesTierResponse updateSalesTier(Long tierId, SalesTierUpdateRequest request);
    QuoteSnapshot quote(Long customerId, int requestedPoints, BigDecimal remainingMerchandise,
            List<LoyaltyMath.Line> lines);
    QuoteSnapshot quoteForCommit(Long customerId, int requestedPoints, BigDecimal remainingMerchandise,
            List<LoyaltyMath.Line> lines);
    void holdOrder(Long orderId, QuoteSnapshot quote);
    void releaseOrderHold(Long orderId);
    void settleOrder(Order order, BigDecimal actualPaid);
    void settleLegacyEarn(Order order, BigDecimal actualPaid);
    void requireConsumed(Order order);
    void enrichCustomerProfile(CustomerRes response, Customer customer);

    static int parsePoints(BigDecimal points) {
        if (points == null) return 0;
        try {
            int value = points.intValueExact();
            if (value < 0) throw invalidPoints("must be non-negative");
            return value;
        } catch (ArithmeticException ex) {
            throw invalidPoints("must be a whole number in the signed 32-bit range");
        }
    }

    private static AppException invalidPoints(String reason) {
        return new AppException(ErrorCode.INVALID_REQUEST, "Dữ liệu không hợp lệ.",
                List.of(new FieldErrorDetail("redeemedPoints", reason)));
    }

    record QuoteSnapshot(int redeemedPoints, BigDecimal pointsDiscount,
            Map<Long, BigDecimal> pointsDiscountBySku, int allowedRedeemedPoints,
            Integer availablePoints, String policyStatus, Long policyId, Long policyVersion,
            BigDecimal redeemRate, BigDecimal earnRate, Long customerId) {}
}
