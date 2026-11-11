package com.springboot.fasearch.modules.search.dto.ai;

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
public class AiApiResponse<T> {

    private boolean success;

    @JsonProperty("status_code")
    private int statusCode;

    private String message;

    private T data;

    private Object errors;
}

