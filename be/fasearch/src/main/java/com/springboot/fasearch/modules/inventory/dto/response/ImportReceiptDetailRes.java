package com.springboot.fasearch.modules.inventory.dto.response;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

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
public class ImportReceiptDetailRes {

    private Long receiptId;
    private String receiptCode;
    private String supplierName;
    private String note;
    private Integer totalItems;
    private Integer totalQuantity;
    private BigDecimal totalAmount;
    private ReceiptStatus status;
    private LocalDateTime createdAt;
    private List<ImportReceiptItemRes> items;
}
