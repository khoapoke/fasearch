package com.springboot.fasearch.modules.payment.repository;

import java.math.BigDecimal;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.springboot.fasearch.common.enums.PaymentStatus;
import com.springboot.fasearch.modules.payment.entity.Invoice;

public interface InvoiceRepository extends JpaRepository<Invoice, Long>, JpaSpecificationExecutor<Invoice> {

    Optional<Invoice> findByOrderId(Long orderId);

    @Query("SELECT i FROM Invoice i WHERE i.order.id IN :orderIds")
    List<Invoice> findByOrderIds(@Param("orderIds") Collection<Long> orderIds);

    boolean existsByOrderIdAndStatus(Long orderId, PaymentStatus status);

    Optional<Invoice> findByInvoiceCode(String invoiceCode);

    boolean existsByInvoiceCode(String invoiceCode);

    long countByInvoiceCodeStartingWith(String prefix);

    @Query(value = "SELECT pg_advisory_xact_lock(:key)", nativeQuery = true)
    void lockInvoiceCodeGeneration(@Param("key") long key);

    @Query("select coalesce(sum(i.totalActualPaid), 0) from Invoice i where i.order.customer.id = :customerId and i.status = :status")
    BigDecimal sumActualPaidByCustomerAndStatus(@Param("customerId") Long customerId,
            @Param("status") PaymentStatus status);

    /** Total paid per customer, one grouped query per export batch (no per-row query). */
    @Query("select i.order.customer.id, coalesce(sum(i.totalActualPaid), 0) from Invoice i "
            + "where i.order.customer.id in :customerIds and i.status = :status group by i.order.customer.id")
    List<Object[]> sumActualPaidByCustomerIdsAndStatus(@Param("customerIds") Collection<Long> customerIds,
            @Param("status") PaymentStatus status);
}
