package com.springboot.fasearch.modules.user.mapper;

import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

import com.springboot.fasearch.modules.user.dto.response.CustomerRes;
import com.springboot.fasearch.modules.user.entity.Customer;

@Mapper(componentModel = "spring")
public interface UserMapper {

    @Mapping(source = "membershipTier.id", target = "tierId")
    @Mapping(source = "membershipTier.tierName", target = "tierName")
    CustomerRes toCustomerResponse(Customer customer);
}
