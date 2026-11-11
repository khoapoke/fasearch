package com.springboot.fasearch.modules.brand.dto.response;

import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class BrandRes {
    private Long id;
    private String name;
    private String slug;
    private String country;
    private String logoUrl;
    private String officialUrl;
}
