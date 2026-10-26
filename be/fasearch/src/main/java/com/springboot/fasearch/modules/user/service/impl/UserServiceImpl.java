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
import com.springboot.fasearch.modules.user.dto.response.CustomerRes;
import com.springboot.fasearch.modules.user.entity.Customer;
import com.springboot.fasearch.modules.user.mapper.UserMapper;
import com.springboot.fasearch.modules.user.repository.UserRepository;
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
    private final UserMapper userMapper;

    @Override
    @Transactional(readOnly = true)
    public CustomerRes getCustomerById(Long id) {
        Customer customer = userRepository.findById(id)
                .orElseThrow(() -> new AppException(ErrorCode.CUSTOMER_NOT_FOUND));

        // RBAC check: Customers can only view their own profile
        boolean isAdminOrStaff = SecurityUtils.hasRole(RoleType.ADMIN.name())
                || SecurityUtils.hasRole(RoleType.STAFF.name());

        if (!isAdminOrStaff && SecurityUtils.hasRole(RoleType.CUSTOMER.name())) {
            String currentUsername = SecurityUtils.getCurrentUsername()
                    .orElseThrow(() -> new AppException(ErrorCode.UNAUTHENTICATED));

            if (customer.getAccount() == null || !currentUsername.equals(customer.getAccount().getUsername())) {
                log.warn("Customer [{}] attempted to access customer detail [{}] without permission", currentUsername, id);
                throw new AppException(ErrorCode.ACCESS_DENIED);
            }
        }

        return userMapper.toCustomerResponse(customer);
    }

    @Override
    @Transactional(readOnly = true)
    public PageResponse<CustomerRes> getCustomers(Pageable pageable, String keyword, Long tierId) {
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

            return cb.and(predicates.toArray(new Predicate[0]));
        };

        Page<Customer> customerPage = userRepository.findAll(spec, pageable);
        Page<CustomerRes> responsePage = customerPage.map(userMapper::toCustomerResponse);

        return PageResponse.from(responsePage);
    }
}
