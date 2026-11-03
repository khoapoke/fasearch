package com.springboot.fasearch.modules.user.repository;

import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.springboot.fasearch.modules.user.entity.Customer;

import jakarta.persistence.LockModeType;

public interface UserRepository extends JpaRepository<Customer, Long>, JpaSpecificationExecutor<Customer> {

    Optional<Customer> findByPhoneNumber(String phoneNumber);

    Optional<Customer> findByAccount_Username(String username);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select c from Customer c where c.id = :id")
    Optional<Customer> findByIdForUpdate(@Param("id") Long id);
}
