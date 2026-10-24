package com.springboot.fasearch.modules.user.mapper;



import org.mapstruct.Mapper;


import com.springboot.fasearch.modules.user.dto.response.CustomerRes;
import com.springboot.fasearch.modules.user.entity.Customer;


@Mapper(componentModel = "spring")
public interface UserMapper {

    CustomerRes toCustomerResponse(Customer customer);


}
