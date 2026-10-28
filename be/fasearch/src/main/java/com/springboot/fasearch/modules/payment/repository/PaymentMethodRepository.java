package com.springboot.fasearch.modules.payment.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

import com.springboot.fasearch.common.enums.PaymentMethodType;
import com.springboot.fasearch.modules.payment.entity.PaymentMethod;

public interface PaymentMethodRepository extends JpaRepository<PaymentMethod, Long>, JpaSpecificationExecutor<PaymentMethod> {

    List<PaymentMethod> findByStatus(String status);

    Optional<PaymentMethod> findByType(PaymentMethodType type);

    Optional<PaymentMethod> findByTypeAndStatus(PaymentMethodType type, String status);
}
