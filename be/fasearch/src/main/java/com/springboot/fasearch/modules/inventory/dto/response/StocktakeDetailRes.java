package com.springboot.fasearch.modules.inventory.dto.response;

import java.time.LocalDateTime;
import java.util.List;

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
public class StocktakeDetailRes {

    private Long stocktakeId;
    private String stocktakeCode;
    private String note;
    private Integer totalDiscrepancy;
    private StocktakeStatus status;
    private LocalDateTime createdAt;
    private List<StocktakeDiscrepancyRes> discrepancies;
}
