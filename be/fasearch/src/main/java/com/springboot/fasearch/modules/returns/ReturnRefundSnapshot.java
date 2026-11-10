package com.springboot.fasearch.modules.returns;

import java.math.BigDecimal;
import jakarta.persistence.*;
import org.hibernate.annotations.Immutable;
import com.springboot.fasearch.modules.order.entity.Order;

/** Read-only mapping used by the customer tier criteria, matching reporting refund semantics. */
@Entity
@Immutable
@Table(name="order_return")
public class ReturnRefundSnapshot {
    @Id private Long id;
    @ManyToOne(fetch=FetchType.LAZY) @JoinColumn(name="order_id") private Order order;
    private String status;
    @Column(name="refund_amount") private BigDecimal refundAmount;
}
