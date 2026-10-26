package com.springboot.fasearch.modules.user.repository;

import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

import com.springboot.fasearch.modules.user.entity.Customer;

public interface UserRepository extends JpaRepository<Customer, Long>, JpaSpecificationExecutor<Customer> {

    Optional<Customer> findByPhoneNumber(String phoneNumber);

    Optional<Customer> findByAccount_Username(String username);
}
