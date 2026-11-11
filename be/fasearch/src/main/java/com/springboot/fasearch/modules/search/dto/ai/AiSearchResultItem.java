package com.springboot.fasearch.modules.search.dto.ai;

import java.util.Map;

import com.fasterxml.jackson.annotation.JsonProperty;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@AllArgsConstructor
@NoArgsConstructor
@Builder
public class AiSearchResultItem {

    private String id;
    private double score;

    @JsonProperty("image_path")
    private String imagePath;

    @JsonProperty("file_name")
    private String fileName;

    private String catalog;

    @JsonProperty("product_id")
    private String productId;

    private Map<String, Object> metadata;
}

