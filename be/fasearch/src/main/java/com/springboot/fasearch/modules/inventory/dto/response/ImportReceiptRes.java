package com.springboot.fasearch.modules.inventory.dto.response;

import java.math.BigDecimal;
import java.time.LocalDateTime;

import com.springboot.fasearch.common.enums.ReceiptStatus;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ImportReceiptRes {

    private Long receiptId;
    private String receiptCode;
    private String supplierName;
    private Integer totalItems;
    private Integer totalQuantity;
    private BigDecimal totalAmount;
    private ReceiptStatus status;
    private LocalDateTime createdAt;
}
