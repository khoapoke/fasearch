package com.springboot.fasearch.modules.search.dto.response;

import java.time.LocalDateTime;

import lombok.Builder;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
@Builder
public class FavoriteRes {

    private Long id;

    private Long productId;

    private String productName;

    private java.math.BigDecimal price;

    private LocalDateTime createdAt;
}