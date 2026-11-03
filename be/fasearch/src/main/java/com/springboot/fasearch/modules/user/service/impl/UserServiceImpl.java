package com.springboot.fasearch.modules.user.service.impl;

import java.util.ArrayList;
import java.util.List;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import com.springboot.fasearch.common.enums.RoleType;
import com.springboot.fasearch.exception.AppException;
import com.springboot.fasearch.exception.ErrorCode;
import com.springboot.fasearch.modules.user.dto.request.CustomerCreateReq;
import com.springboot.fasearch.modules.user.dto.request.CustomerUpdateReq;
import com.springboot.fasearch.modules.user.dto.response.CustomerRes;
import com.springboot.fasearch.modules.user.entity.Customer;
import com.springboot.fasearch.modules.user.entity.MembershipTier;
import com.springboot.fasearch.modules.user.mapper.UserMapper;
import com.springboot.fasearch.modules.user.repository.MembershipTierRepository;
import com.springboot.fasearch.modules.user.repository.UserRepository;
import com.springboot.fasearch.modules.loyalty.service.LoyaltyService;
import com.springboot.fasearch.modules.payment.entity.Invoice;
import com.springboot.fasearch.common.enums.PaymentStatus;
import com.springboot.fasearch.modules.user.service.interfaces.UserService;
import com.springboot.fasearch.security.SecurityUtils;
import com.springboot.fasearch.shared.PageResponse;

import jakarta.persistence.criteria.Predicate;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Slf4j
@Service
@RequiredArgsConstructor
public class UserServiceImpl implements UserService {

    private final UserRepository userRepository;
    private final MembershipTierRepository membershipTierRepository;
    private final UserMapper userMapper;
    private final LoyaltyService loyaltyService;

    @Override
    @Transactional(readOnly = true)
    public CustomerRes getCustomerById(Long id) {
        Customer customer = userRepository.findById(id)
                .orElseThrow(() -> new AppException(ErrorCode.CUSTOMER_NOT_FOUND));

        // RBAC check: Customers can only view their own profile
        verifyCustomerOwnership(customer, id, "access");

        CustomerRes response = userMapper.toCustomerResponse(customer);
        loyaltyService.enrichCustomerProfile(response, customer);
        return response;
    }

    @Override
    @Transactional(readOnly = true)
    public PageResponse<CustomerRes> getCustomers(Pageable pageable, String keyword, Long tierId, Long salesTierId) {
        Specification<Customer> spec = (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();

            if (StringUtils.hasText(keyword)) {
                String searchKeyword = "%" + keyword.trim().toLowerCase() + "%";
                predicates.add(cb.or(
                        cb.like(cb.lower(root.get("firstName")), searchKeyword),
                        cb.like(cb.lower(root.get("lastName")), searchKeyword),
                        cb.like(cb.lower(root.get("phoneNumber")), searchKeyword)
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
                            cb.equal(invoice.get("status"), PaymentStatus.PAID));
                    predicates.add(cb.isTrue(root.get("salesHistoryComplete")));
                    predicates.add(cb.greaterThanOrEqualTo(invoices, salesTier.getMinimumCumulativePaidSales()));
                    membershipTierRepository.findAll().stream()
                            .map(MembershipTier::getMinimumCumulativePaidSales)
                            .filter(value -> value != null && value.compareTo(salesTier.getMinimumCumulativePaidSales()) > 0)
                            .min(java.math.BigDecimal::compareTo)
                            .ifPresent(next -> predicates.add(cb.lessThan(invoices, next)));
                }
            }

            return cb.and(predicates.toArray(new Predicate[0]));
        };

        Page<Customer> customerPage = userRepository.findAll(spec, pageable);
        Page<CustomerRes> responsePage = customerPage.map(customer -> {
            CustomerRes response = userMapper.toCustomerResponse(customer);
            loyaltyService.enrichCustomerProfile(response, customer);
            return response;
        });

        return PageResponse.from(responsePage);
    }

    @Override
    @Transactional
    public CustomerRes createCustomer(CustomerCreateReq req) {
        if (userRepository.findByPhoneNumber(req.getPhoneNumber()).isPresent()) {
            throw new AppException(ErrorCode.PHONE_NUMBER_ALREADY_EXISTS);
        }

        Customer customer = userMapper.toCustomer(req);
        customer.setAccumulatePoint(0);
        customer.setSalesHistoryComplete(true);
        customer.setIsDeleted(false);

        // Assign default membership tier (thresholdPoint = 0)
        membershipTierRepository.findFirstByOrderByThresholdPointAsc()
                .ifPresent(customer::setMembershipTier);

        Customer savedCustomer = userRepository.save(customer);
        log.info("Created customer successfully with ID: {}", savedCustomer.getId());

        return userMapper.toCustomerResponse(savedCustomer);
    }

    @Override
    @Transactional
    public CustomerRes updateCustomer(Long id, CustomerUpdateReq req) {
        Customer customer = userRepository.findByIdForUpdate(id)
                .orElseThrow(() -> new AppException(ErrorCode.CUSTOMER_NOT_FOUND));

        // RBAC check: Customers can only update their own profile
        verifyCustomerOwnership(customer, id, "update");

        // Validate phone number uniqueness if modified
        if (StringUtils.hasText(req.getPhoneNumber()) && !req.getPhoneNumber().equals(customer.getPhoneNumber())) {
            if (userRepository.findByPhoneNumber(req.getPhoneNumber()).isPresent()) {
                throw new AppException(ErrorCode.PHONE_NUMBER_ALREADY_EXISTS);
            }
        }

        // Partial update: ignore null fields
        userMapper.updateCustomerFromReq(req, customer);

        Customer updatedCustomer = userRepository.save(customer);
        log.info("Updated customer profile for ID: {}", updatedCustomer.getId());

        return userMapper.toCustomerResponse(updatedCustomer);
    }

    @Override
    @Transactional
    public void deleteCustomer(Long id) {
        Customer customer = userRepository.findById(id)
                .orElseThrow(() -> new AppException(ErrorCode.CUSTOMER_NOT_FOUND));

        customer.setIsDeleted(true);
        userRepository.save(customer);

        log.info("Soft deleted customer successfully with ID: {}", id);
    }

    private void verifyCustomerOwnership(Customer customer, Long customerId, String action) {
        boolean isAdminOrStaff = SecurityUtils.hasRole(RoleType.ADMIN.name())
                || SecurityUtils.hasRole(RoleType.STAFF.name());

        if (!isAdminOrStaff && SecurityUtils.hasRole(RoleType.CUSTOMER.name())) {
            String currentUsername = SecurityUtils.getCurrentUsername()
                    .orElseThrow(() -> new AppException(ErrorCode.UNAUTHENTICATED));

            if (customer.getAccount() == null || !currentUsername.equals(customer.getAccount().getUsername())) {
                log.warn("Customer [{}] attempted to {} customer [{}] without permission", currentUsername, action, customerId);
                throw new AppException(ErrorCode.ACCESS_DENIED);
            }
        }
    }
}
