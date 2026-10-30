package com.springboot.fasearch.modules.inventory.dto.response;

import java.time.LocalDateTime;
import java.util.List;

import com.springboot.fasearch.common.enums.ExportType;
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
public class ExportReceiptDetailRes {

    private Long receiptId;
    private String receiptCode;
    private ExportType exportType;
    private String note;
    private Integer totalItems;
    private Integer totalQuantity;
    private ReceiptStatus status;
    private LocalDateTime createdAt;
    private List<ExportReceiptItemRes> items;
}
