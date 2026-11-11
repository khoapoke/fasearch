package com.springboot.fasearch.exception;

import java.util.List;

import lombok.Getter;

@Getter
public class AppException extends RuntimeException {
    private final ErrorCode errorCode;
    private final List<FieldErrorDetail> errors;

    public AppException(ErrorCode errorCode) {
        super(errorCode.getMessage());
        this.errorCode = errorCode;
        this.errors = null;
    }

    public AppException(ErrorCode errorCode, String message) {
        super(message);
        this.errorCode = errorCode;
        this.errors = null;
    }

    public AppException(ErrorCode errorCode, String message, List<FieldErrorDetail> errors) {
        super(message);
        this.errorCode = errorCode;
        this.errors = errors;
    }
}
