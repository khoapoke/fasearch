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

    @Query(value="select order_id,sum(refund_amount) from order_return where order_id in (:ids) and status='REFUNDED' group by order_id",nativeQuery=true)
    List<Object[]> refundedByOrderIds(@Param("ids") Collection<Long> ids);

    boolean existsByOrderIdAndStatus(Long orderId, PaymentStatus status);

    Optional<Invoice> findByInvoiceCode(String invoiceCode);

    boolean existsByInvoiceCode(String invoiceCode);

    long countByInvoiceCodeStartingWith(String prefix);

    @Query(value = "SELECT pg_advisory_xact_lock(:key)", nativeQuery = true)
    void lockInvoiceCodeGeneration(@Param("key") long key);

    @Query(value = "select coalesce(sum(i.tong_tien_thuc_tra - coalesce((select sum(r.refund_amount) "
            + "from order_return r where r.order_id=i.ma_don_hang and r.status='REFUNDED'),0)),0) "
            + "from hoa_don i join don_hang d on d.ma_don_hang=i.ma_don_hang "
            + "where d.ma_kh=:customerId and (i.trang_thai=:#{#status.name()} or (:#{#status.name()}='PAID' and i.trang_thai='REFUNDED')) and i.da_xoa=false and d.da_xoa=false",
            nativeQuery = true)
    BigDecimal sumActualPaidByCustomerAndStatus(@Param("customerId") Long customerId,
            @Param("status") PaymentStatus status);

    /** Total paid per customer, one grouped query per export batch (no per-row query). */
    @Query(value = "select d.ma_kh, coalesce(sum(i.tong_tien_thuc_tra - coalesce((select sum(r.refund_amount) "
            + "from order_return r where r.order_id=i.ma_don_hang and r.status='REFUNDED'),0)),0) "
            + "from hoa_don i join don_hang d on d.ma_don_hang=i.ma_don_hang "
            + "where d.ma_kh in (:customerIds) and (i.trang_thai=:#{#status.name()} or (:#{#status.name()}='PAID' and i.trang_thai='REFUNDED')) and i.da_xoa=false and d.da_xoa=false "
            + "group by d.ma_kh", nativeQuery = true)
    List<Object[]> sumActualPaidByCustomerIdsAndStatus(@Param("customerIds") Collection<Long> customerIds,
            @Param("status") PaymentStatus status);
}
