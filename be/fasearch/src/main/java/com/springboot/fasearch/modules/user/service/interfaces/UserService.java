package com.springboot.fasearch.modules.user.service.interfaces;

import java.util.List;

import com.springboot.fasearch.modules.user.dto.response.CustomerRes;


public interface UserService {
    CustomerRes getCustomerById(Long id);
    List<CustomerRes> getListCustomers();
}
