package com.springboot.fasearch.modules.product.dto.response;

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
public class CategoryRes {

    private Long id;
    private String categoryName;

    /** Published-product count; only set by the with-counts endpoint, null elsewhere. */
    private Long productCount;
}
