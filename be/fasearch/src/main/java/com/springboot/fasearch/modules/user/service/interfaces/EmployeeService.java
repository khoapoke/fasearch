package com.springboot.fasearch.modules.user.service.interfaces;

import org.springframework.data.domain.Pageable;

import com.springboot.fasearch.modules.user.dto.request.EmployeeCreateReq;
import com.springboot.fasearch.modules.user.dto.request.EmployeeUpdateReq;
import com.springboot.fasearch.modules.user.dto.response.EmployeeRes;
import com.springboot.fasearch.shared.PageResponse;

public interface EmployeeService {

    PageResponse<EmployeeRes> getEmployees(Pageable pageable, String keyword);

    EmployeeRes getEmployeeById(Long id);

    EmployeeRes createEmployee(EmployeeCreateReq req);

    EmployeeRes updateEmployee(Long id, EmployeeUpdateReq req);

    void deleteEmployee(Long id);
}
