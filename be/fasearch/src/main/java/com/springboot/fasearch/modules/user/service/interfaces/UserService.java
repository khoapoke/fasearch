package com.springboot.fasearch.modules.user.service.interfaces;

import org.springframework.data.domain.Pageable;

import com.springboot.fasearch.modules.user.dto.response.CustomerRes;
import com.springboot.fasearch.shared.PageResponse;

public interface UserService {

    CustomerRes getCustomerById(Long id);

    PageResponse<CustomerRes> getCustomers(Pageable pageable, String keyword, Long tierId);
}
