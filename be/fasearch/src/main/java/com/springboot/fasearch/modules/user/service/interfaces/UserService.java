package com.springboot.fasearch.modules.user.service.interfaces;

import org.springframework.data.domain.Pageable;

import com.springboot.fasearch.modules.user.dto.request.CustomerCreateReq;
import com.springboot.fasearch.modules.user.dto.request.CustomerUpdateReq;
import com.springboot.fasearch.modules.user.dto.response.CustomerRes;
import com.springboot.fasearch.shared.PageResponse;

public interface UserService {

    CustomerRes getCustomerById(Long id);

    PageResponse<CustomerRes> getCustomers(Pageable pageable, String keyword, Long tierId, Long salesTierId);

    CustomerRes createCustomer(CustomerCreateReq req);

    CustomerRes updateCustomer(Long id, CustomerUpdateReq req);

    void deleteCustomer(Long id);
}
