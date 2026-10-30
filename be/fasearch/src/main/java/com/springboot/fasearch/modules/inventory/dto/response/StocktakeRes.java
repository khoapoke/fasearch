package com.springboot.fasearch.modules.inventory.dto.response;

import java.time.LocalDateTime;

import com.springboot.fasearch.common.enums.StocktakeStatus;

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
public class StocktakeRes {

    private Long stocktakeId;
    private String stocktakeCode;
    private String note;
    private Integer totalItems;
    private Integer totalDiscrepancy;
    private StocktakeStatus status;
    private LocalDateTime createdAt;
}
