package com.springboot.fasearch.exception;

import org.springframework.http.HttpStatus;

import lombok.AllArgsConstructor;
import lombok.Getter;

@AllArgsConstructor
@Getter
public enum ErrorCode {

    // Common & System errors
    INTERNAL_SERVER_ERROR(500, "Something went wrong", HttpStatus.INTERNAL_SERVER_ERROR),
    INVALID_REQUEST(400, "Invalid request data", HttpStatus.BAD_REQUEST),
    UNAUTHORIZED(401, "Unauthorized", HttpStatus.UNAUTHORIZED),
    FORBIDDEN(403, "Access denied", HttpStatus.FORBIDDEN),
    RESOURCE_NOT_FOUND(404, "Resource not found", HttpStatus.NOT_FOUND),
    METHOD_NOT_ALLOWED(405, "HTTP method not supported", HttpStatus.METHOD_NOT_ALLOWED),
    REQUEST_TIMEOUT(408, "Request has timeout", HttpStatus.REQUEST_TIMEOUT),

    // User & Customer errors
    CUSTOMER_NOT_FOUND(404, "Customer not found", HttpStatus.NOT_FOUND),
    USER_NOT_FOUND(404, "User not found", HttpStatus.NOT_FOUND),
    USER_ALREADY_EXISTS(400, "User already exists", HttpStatus.BAD_REQUEST),
    USERNAME_ALREADY_EXISTS(400, "Username already exists", HttpStatus.BAD_REQUEST),
    PHONE_NUMBER_ALREADY_EXISTS(400, "Phone number already exists", HttpStatus.BAD_REQUEST),
    EMAIL_ALREADY_EXISTS(400, "Email already exists", HttpStatus.BAD_REQUEST),

    // Auth & Security errors
    INVALID_CREDENTIALS(401, "Invalid username or password", HttpStatus.UNAUTHORIZED),
    ACCOUNT_LOCKED(403, "Account is locked", HttpStatus.FORBIDDEN),
    ACCOUNT_INACTIVE(403, "Account is not active", HttpStatus.FORBIDDEN),
    ROLE_NOT_FOUND(404, "Role not found", HttpStatus.NOT_FOUND),
    UNAUTHENTICATED(401, "Full authentication is required to access this resource", HttpStatus.UNAUTHORIZED),
    ACCESS_DENIED(403, "You do not have permission to access this resource", HttpStatus.FORBIDDEN),
    INVALID_TOKEN(401, "Token is invalid or expired", HttpStatus.UNAUTHORIZED);

    private final Integer code;
    private final String message;
    private final HttpStatus httpStatus;
}
