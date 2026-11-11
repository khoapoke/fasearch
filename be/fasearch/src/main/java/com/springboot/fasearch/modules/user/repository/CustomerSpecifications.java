package com.springboot.fasearch.modules.user.repository;

import java.util.ArrayList;
import java.util.List;

import org.springframework.data.jpa.domain.Specification;

import com.springboot.fasearch.common.enums.PaymentStatus;
import com.springboot.fasearch.common.search.SearchTextNormalizer;
import com.springboot.fasearch.modules.payment.entity.Invoice;
import com.springboot.fasearch.modules.user.entity.Customer;
import com.springboot.fasearch.modules.user.entity.MembershipTier;

import jakarta.persistence.criteria.Join;
import jakarta.persistence.criteria.JoinType;
import jakarta.persistence.criteria.Predicate;

/** The customer list filters, shared by the admin list page and the CSV export. */
public final class CustomerSpecifications {

    private CustomerSpecifications() {
    }

    public static Specification<Customer> list(
            String keyword,
            Long tierId,
            Long salesTierId,
            MembershipTierRepository membershipTierRepository) {
        return (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();

            String keywordPattern = SearchTextNormalizer.containsPattern(keyword);
            if (keywordPattern != null) {
                Join<Customer, ?> accountJoin = root.join("account", JoinType.LEFT);
                predicates.add(cb.or(
                        cb.like(root.get("searchText"), keywordPattern, SearchTextNormalizer.LIKE_ESCAPE),
                        cb.like(cb.lower(accountJoin.get("email")), keywordPattern,
                                SearchTextNormalizer.LIKE_ESCAPE)
                ));
            }

            if (tierId != null) {
                predicates.add(cb.equal(root.get("membershipTier").get("id"), tierId));
            }

            if (salesTierId != null) {
                MembershipTier salesTier = membershipTierRepository.findById(salesTierId).orElse(null);
                if (salesTier == null || salesTier.getMinimumCumulativePaidSales() == null) {
                    predicates.add(cb.disjunction());
                } else {
                    var invoices = query.subquery(java.math.BigDecimal.class);
                    var invoice = invoices.from(Invoice.class);
                    invoices.select(cb.coalesce(cb.sum(invoice.get("totalActualPaid")), java.math.BigDecimal.ZERO));
                    invoices.where(cb.equal(invoice.get("order").get("customer").get("id"), root.get("id")),
                            invoice.get("status").in(PaymentStatus.PAID, PaymentStatus.REFUNDED),
                            cb.isFalse(invoice.get("order").get("isDeleted")));
                    var refunds = query.subquery(java.math.BigDecimal.class);
                    var refund = refunds.from(com.springboot.fasearch.modules.returns.ReturnRefundSnapshot.class);
                    refunds.select(cb.coalesce(cb.sum(refund.<java.math.BigDecimal>get("refundAmount")),java.math.BigDecimal.ZERO));
                    refunds.where(cb.equal(refund.get("order").get("customer").get("id"),root.get("id")),
                            cb.equal(refund.get("status"),"REFUNDED"), cb.isFalse(refund.get("order").get("isDeleted")));
                    var netSales=cb.diff(invoices,refunds);
                    predicates.add(cb.isTrue(root.get("salesHistoryComplete")));
                    predicates.add(cb.greaterThanOrEqualTo(netSales, salesTier.getMinimumCumulativePaidSales()));
                    membershipTierRepository.findAll().stream()
                            .map(MembershipTier::getMinimumCumulativePaidSales)
                            .filter(value -> value != null && value.compareTo(salesTier.getMinimumCumulativePaidSales()) > 0)
                            .min(java.math.BigDecimal::compareTo)
                            .ifPresent(next -> predicates.add(cb.lessThan(netSales, next)));
                }
            }

            return cb.and(predicates.toArray(new Predicate[0]));
        };
    }
}
