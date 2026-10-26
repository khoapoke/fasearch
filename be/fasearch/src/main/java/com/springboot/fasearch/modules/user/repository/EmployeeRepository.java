package com.springboot.fasearch.modules.user.repository;

import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

import com.springboot.fasearch.modules.user.entity.Employee;

public interface EmployeeRepository extends JpaRepository<Employee, Long>, JpaSpecificationExecutor<Employee> {

    Optional<Employee> findByPhoneNumber(String phoneNumber);

    Optional<Employee> findByCccd(String cccd);

    Optional<Employee> findByAccountId(Long accountId);
}
