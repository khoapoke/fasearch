package com.springboot.fasearch.modules.user.controller;

import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import com.springboot.fasearch.modules.user.dto.response.CustomerRes;
import com.springboot.fasearch.modules.user.service.interfaces.UserService;
import com.springboot.fasearch.shared.ApiResponse;

import lombok.RequiredArgsConstructor;

@RestController 
@RequestMapping ("api/v1/users")
@RequiredArgsConstructor
public class UserController {

    private final UserService userService;

    @GetMapping("/customers")
    @ResponseStatus(HttpStatus.OK)
    public ApiResponse<List<CustomerRes>> getCustomers(){
        
        List<CustomerRes> listCustomerRes= userService.getListCustomers();
        return ApiResponse.success(200, "lấy danh sách khách hàng thành công", listCustomerRes); 
        
    }

    @GetMapping("/customers/{id}")
    @ResponseStatus(HttpStatus.OK)
    public ApiResponse<CustomerRes> getCustomer(@PathVariable Long id) {
        CustomerRes response = userService.getCustomerById(id);
        return ApiResponse.success(200, "Lấy chi tiết người dùng thành công", response);
    }


}
