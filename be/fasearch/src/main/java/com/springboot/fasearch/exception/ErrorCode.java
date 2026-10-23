package com.springboot.fasearch.exception;

import lombok.AllArgsConstructor;
import lombok.Getter;

@AllArgsConstructor
@Getter
public enum ErrorCode {

    REQUEST_TIMEOUT(400, " Request has timeout");

    private final Integer code;
    private final String message;
}
