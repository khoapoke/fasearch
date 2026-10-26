package com.springboot.fasearch.modules.user.mapper;

import org.mapstruct.BeanMapping;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;
import org.mapstruct.MappingTarget;
import org.mapstruct.NullValuePropertyMappingStrategy;

import org.mapstruct.ReportingPolicy;

import com.springboot.fasearch.modules.user.dto.request.CustomerCreateReq;
import com.springboot.fasearch.modules.user.dto.request.CustomerUpdateReq;
import com.springboot.fasearch.modules.user.dto.response.CustomerRes;
import com.springboot.fasearch.modules.user.entity.Customer;

@Mapper(componentModel = "spring", unmappedTargetPolicy = ReportingPolicy.IGNORE)
public interface UserMapper {

    @Mapping(source = "membershipTier.id", target = "tierId")
    @Mapping(source = "membershipTier.tierName", target = "tierName")
    CustomerRes toCustomerResponse(Customer customer);

    Customer toCustomer(CustomerCreateReq req);

    @BeanMapping(nullValuePropertyMappingStrategy = NullValuePropertyMappingStrategy.IGNORE)
    void updateCustomerFromReq(CustomerUpdateReq req, @MappingTarget Customer customer);
}
