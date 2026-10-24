package com.springboot.fasearch.exception;

import lombok.AllArgsConstructor;
import lombok.Getter;

@AllArgsConstructor
@Getter
public enum ErrorCode {

    CUSTOMER_NOT_FOUND(404,"Customer not found"),
    REQUEST_TIMEOUT(400, " Request has timeout");

    private final Integer code;
    private final String message;
}
