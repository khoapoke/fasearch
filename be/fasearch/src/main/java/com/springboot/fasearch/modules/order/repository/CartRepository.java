package com.springboot.fasearch.modules.order.repository;

import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.springboot.fasearch.modules.order.entity.Cart;

import jakarta.persistence.LockModeType;

public interface CartRepository extends JpaRepository<Cart, Long> {

    Optional<Cart> findByCustomerId(Long customerId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select c from Cart c where c.customer.id = :customerId")
    Optional<Cart> findByCustomerIdForUpdate(@Param("customerId") Long customerId);

    Optional<Cart> findByCustomer_Account_Username(String username);
}
