package com.springboot.fasearch.modules.user.service.impl;

import java.util.List;

import org.springframework.stereotype.Service;

import com.springboot.fasearch.exception.AppException;
import com.springboot.fasearch.exception.ErrorCode;
import com.springboot.fasearch.modules.user.dto.response.CustomerRes;
import com.springboot.fasearch.modules.user.entity.Customer;
import com.springboot.fasearch.modules.user.mapper.UserMapper;
import com.springboot.fasearch.modules.user.repository.UserRepository;
import com.springboot.fasearch.modules.user.service.interfaces.UserServiceInterface;


import lombok.RequiredArgsConstructor;

@Service 
@RequiredArgsConstructor 
public class UserService implements UserServiceInterface {
    private final UserRepository userRepository;
    private final UserMapper userMapper;


    @Override 
    public CustomerRes getCustomerById(Long id) {
        // Tìm Khách hàng, nếu không có thì ném lỗi (tới lớp Exception Handler xử lý)
        Customer user = userRepository.findById(id).orElseThrow(()-> new AppException(ErrorCode.CUSTOMER_NOT_FOUND
        ));
        
        // Dùng Mapper để map Entity -> DTO và trả về
        return userMapper.toCustomerResponse(user);
    }
    @Override 
    public List<CustomerRes> getListCustomers(){
        
        return userRepository.findAll()
        .stream()
        .map(cus->userMapper.toCustomerResponse(cus))
        .toList();

    }
}
