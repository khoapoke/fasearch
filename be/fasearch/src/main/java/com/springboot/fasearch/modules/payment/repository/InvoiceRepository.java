package com.springboot.fasearch.modules.payment.repository;

import java.math.BigDecimal;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.springboot.fasearch.common.enums.PaymentStatus;
import com.springboot.fasearch.modules.payment.entity.Invoice;

public interface InvoiceRepository extends JpaRepository<Invoice, Long>, JpaSpecificationExecutor<Invoice> {

    Optional<Invoice> findByOrderId(Long orderId);

    boolean existsByOrderIdAndStatus(Long orderId, PaymentStatus status);

    Optional<Invoice> findByInvoiceCode(String invoiceCode);

    boolean existsByInvoiceCode(String invoiceCode);

    long countByInvoiceCodeStartingWith(String prefix);

    @Query(value = "SELECT pg_advisory_xact_lock(:key)", nativeQuery = true)
    void lockInvoiceCodeGeneration(@Param("key") long key);

    @Query("select coalesce(sum(i.totalActualPaid), 0) from Invoice i where i.order.customer.id = :customerId and i.status = :status")
    BigDecimal sumActualPaidByCustomerAndStatus(@Param("customerId") Long customerId,
            @Param("status") PaymentStatus status);
}
