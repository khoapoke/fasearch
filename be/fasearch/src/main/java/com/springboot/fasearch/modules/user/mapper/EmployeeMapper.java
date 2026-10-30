package com.springboot.fasearch.modules.user.mapper;

import org.mapstruct.BeanMapping;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;
import org.mapstruct.MappingTarget;
import org.mapstruct.NullValuePropertyMappingStrategy;
import org.mapstruct.ReportingPolicy;

import com.springboot.fasearch.modules.user.dto.request.EmployeeCreateReq;
import com.springboot.fasearch.modules.user.dto.request.EmployeeUpdateReq;
import com.springboot.fasearch.modules.user.dto.response.EmployeeRes;
import com.springboot.fasearch.modules.user.entity.Employee;

@Mapper(componentModel = "spring", unmappedTargetPolicy = ReportingPolicy.IGNORE)
public interface EmployeeMapper {

    @Mapping(source = "account.id", target = "accountId")
    @Mapping(source = "account.username", target = "username")
    @Mapping(source = "account.role.name", target = "role")
    EmployeeRes toEmployeeResponse(Employee employee);

    Employee toEmployee(EmployeeCreateReq req);

    @BeanMapping(nullValuePropertyMappingStrategy = NullValuePropertyMappingStrategy.IGNORE)
    void updateEmployeeFromReq(EmployeeUpdateReq req, @MappingTarget Employee employee);
}
